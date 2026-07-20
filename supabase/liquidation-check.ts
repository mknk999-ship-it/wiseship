// Supabase Edge Function (Deno): 강제청산 + TP/SL 체결 감시 크론 잡.
// 배포 시 Supabase CLI 규칙에 맞게 supabase/functions/liquidation-check/index.ts 로
// 옮겨서 `supabase functions deploy liquidation-check` 실행. 그 후 대시보드 또는
// pg_cron으로 주기 호출 스케줄(예: 매 1분)을 등록한다.
//
// 필요 시크릿 (Edge Function Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — Supabase가 기본 제공
//   LIQUIDATION_CRON_SECRET — 아무나 이 HTTP 엔드포인트를 호출하지 못하도록,
//     크론 트리거가 보내는 Authorization 헤더와 대조할 임의의 값
//
// 판정 우선순위 (포지션당 매 실행마다 하나만 처리): 강제청산 > TP > SL.
// 강제청산 조건은 lib/engine.ts의 isLiquidated와 동일 (Deno 런타임이라 직접 import는 못 하고
// 로직만 그대로 복제): 롱은 mark <= liq_price, 숏은 mark >= liq_price.
// 강제청산 시 status='liquidated', close_price=마크가, realized_pnl=-margin, 잔고 복귀 없음
// (liquidate_position RPC).
// TP/SL 도달 시에는 lib/engine.ts의 closePosition과 동일한 공식(수수료 적용,
// margin+realized 잔고 복귀)으로 정산하고, close_position RPC를 p_reason='tp'/'sl'로
// 호출해 transactions.type에 그대로 기록한다.
// 이중 처리 방지는 각 RPC가 status='open' 행만 잠가 처리하는 것으로 보장.

import { createClient } from "npm:@supabase/supabase-js@2";

type Symbol = "BTC-USDT-SWAP" | "ETH-USDT-SWAP";
type Side = "long" | "short";

const SYMBOLS: Symbol[] = ["BTC-USDT-SWAP", "ETH-USDT-SWAP"];
const TAKER_FEE = 0.0005; // lib/engine.ts의 TAKER_FEE와 동일

// lib/prices.ts의 getOkxMarkPrice와 동일한 엔드포인트/로직
async function getOkxMarkPrice(symbol: Symbol): Promise<number> {
  const res = await fetch(
    `https://www.okx.com/api/v5/public/mark-price?instId=${symbol}`,
  );
  const json = await res.json();
  return parseFloat(json.data[0].markPx);
}

// lib/engine.ts의 isLiquidated와 동일한 조건
function isLiquidated(side: Side, liqPrice: number, mark: number): boolean {
  return side === "long" ? mark <= liqPrice : mark >= liqPrice;
}

// lib/engine.ts의 unrealizedPnl과 동일한 공식
function unrealizedPnl(
  side: Side,
  entry: number,
  mark: number,
  qty: number,
): number {
  return side === "long" ? (mark - entry) * qty : (entry - mark) * qty;
}

// lib/engine.ts의 closePosition과 동일한 공식 (수수료 적용, margin+realized 잔고 복귀)
function closePosition(
  side: Side,
  entry: number,
  mark: number,
  qty: number,
  margin: number,
) {
  const pnl = unrealizedPnl(side, entry, mark, qty);
  const closeFee = mark * qty * TAKER_FEE;
  const realized = pnl - closeFee;
  const returnToBalance = Math.max(0, margin + realized);
  return { closeFee, pnl, realized, returnToBalance };
}

type OpenPositionRow = {
  id: string;
  user_id: string;
  symbol: Symbol;
  side: Side;
  margin: number;
  qty: number;
  entry_price: number;
  liq_price: number;
  tp_price: number | null;
  sl_price: number | null;
};

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("LIQUIDATION_CRON_SECRET");
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.",
      }),
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: openPositions, error: fetchError } = await supabase
    .from("positions")
    .select("id, user_id, symbol, side, margin, qty, entry_price, liq_price, tp_price, sl_price")
    .eq("status", "open");

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
    });
  }

  const positions = (openPositions ?? []) as OpenPositionRow[];
  if (positions.length === 0) {
    return new Response(
      JSON.stringify({ checked: 0, liquidated: 0, tpClosed: 0, slClosed: 0, errors: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // 심볼별로 마크가격을 한 번씩만 조회 (포지션마다 중복 조회 방지)
  const markPrices = new Map<Symbol, number>();
  for (const symbol of SYMBOLS) {
    if (!positions.some((p) => p.symbol === symbol)) continue;
    try {
      markPrices.set(symbol, await getOkxMarkPrice(symbol));
    } catch (err) {
      console.error(`시세 조회 실패 (${symbol}):`, err);
    }
  }

  let liquidatedCount = 0;
  let tpClosedCount = 0;
  let slClosedCount = 0;
  const errors: string[] = [];

  for (const position of positions) {
    const mark = markPrices.get(position.symbol);
    if (mark == null) continue; // 이번 실행에서 해당 심볼 시세 조회 실패 → 다음 주기에 재시도

    // 우선순위 1: 강제청산 (걸리면 TP/SL은 검사하지 않음)
    if (isLiquidated(position.side, position.liq_price, mark)) {
      const { data: didLiquidate, error: rpcError } = await supabase.rpc(
        "liquidate_position",
        { p_position_id: position.id, p_close_price: mark },
      );
      if (rpcError) {
        errors.push(`${position.id} (liquidate): ${rpcError.message}`);
      } else if (didLiquidate) {
        liquidatedCount++;
      }
      continue;
    }

    // 우선순위 2: TP 도달
    const tpHit =
      position.tp_price != null &&
      (position.side === "long"
        ? mark >= position.tp_price
        : mark <= position.tp_price);

    // 우선순위 3: SL 도달
    const slHit =
      !tpHit &&
      position.sl_price != null &&
      (position.side === "long"
        ? mark <= position.sl_price
        : mark >= position.sl_price);

    if (!tpHit && !slHit) continue;

    const result = closePosition(
      position.side,
      position.entry_price,
      mark,
      position.qty,
      position.margin,
    );

    const { error: rpcError } = await supabase.rpc("close_position", {
      p_user_id: position.user_id,
      p_position_id: position.id,
      p_close_price: mark,
      p_close_fee: result.closeFee,
      p_realized: result.realized,
      p_return_to_balance: result.returnToBalance,
      p_reason: tpHit ? "tp" : "sl",
    });

    if (rpcError) {
      errors.push(`${position.id} (${tpHit ? "tp" : "sl"}): ${rpcError.message}`);
      continue;
    }
    if (tpHit) tpClosedCount++;
    else slClosedCount++;
  }

  return new Response(
    JSON.stringify({
      checked: positions.length,
      liquidated: liquidatedCount,
      tpClosed: tpClosedCount,
      slClosed: slClosedCount,
      errors,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
