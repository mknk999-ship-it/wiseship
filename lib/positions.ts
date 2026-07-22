import type { SupabaseClient } from "@supabase/supabase-js";

import { unrealizedPnl, type Side } from "@/lib/engine";
import { getOkxMarkPrice, type Symbol } from "@/lib/prices";

export type OpenPosition = {
  id: string;
  symbol: Symbol;
  side: Side;
  margin: number;
  leverage: number;
  qty: number;
  entry_price: number;
  liq_price: number;
  tp_price: number | null;
  sl_price: number | null;
  opened_at: string;
};

export async function getOpenPositionCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("positions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "open");
  return count ?? 0;
}

export async function getOpenPositions(
  supabase: SupabaseClient,
  userId: string,
): Promise<OpenPosition[]> {
  const { data } = await supabase
    .from("positions")
    .select(
      "id, symbol, side, margin, leverage, qty, entry_price, liq_price, tp_price, sl_price, opened_at",
    )
    .eq("user_id", userId)
    .eq("status", "open")
    .order("opened_at", { ascending: false });
  return (data ?? []) as OpenPosition[];
}

export type PositionAggregate = {
  totalMargin: number;
  totalUnrealizedPnl: number;
  openCount: number;
};

/**
 * 한 유저의 오픈 포지션 전체를 대상으로 총 증거금·총 미실현손익을 구한다.
 * "총 평가자산" 계산(lib/equity.ts의 calcTotalEquity)에 넣을 입력값을 만드는 용도.
 * 마크가격 조회에 실패한 심볼의 포지션은 증거금만 반영하고 미실현손익은 0으로 취급한다
 * (lib/ranking.ts의 기존 배치 계산과 동일한 완화 처리).
 */
export async function getPositionAggregate(
  supabase: SupabaseClient,
  userId: string,
): Promise<PositionAggregate> {
  const positions = await getOpenPositions(supabase, userId);

  const uniqueSymbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const markPrices = new Map<Symbol, number>();
  for (const symbol of uniqueSymbols) {
    try {
      markPrices.set(symbol, await getOkxMarkPrice(symbol));
    } catch {
      // 조회 실패 시 해당 심볼 포지션은 미실현손익 0으로 취급
    }
  }

  let totalMargin = 0;
  let totalUnrealizedPnl = 0;
  for (const p of positions) {
    totalMargin += p.margin;
    const mark = markPrices.get(p.symbol);
    if (mark != null) {
      totalUnrealizedPnl += unrealizedPnl(p.side, p.entry_price, mark, p.qty);
    }
  }

  return { totalMargin, totalUnrealizedPnl, openCount: positions.length };
}

export type ClosedPosition = {
  id: string;
  symbol: Symbol;
  side: Side;
  leverage: number;
  margin: number;
  entry_price: number;
  close_price: number | null;
  realized_pnl: number | null;
  status: "closed" | "liquidated";
  closed_at: string;
};

export async function getClosedPositions(
  supabase: SupabaseClient,
  userId: string,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ items: ClosedPosition[]; total: number }> {
  const { data, count } = await supabase
    .from("positions")
    .select(
      "id, symbol, side, leverage, margin, entry_price, close_price, realized_pnl, status, closed_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .in("status", ["closed", "liquidated"])
    .order("closed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { items: (data ?? []) as ClosedPosition[], total: count ?? 0 };
}

export type CloseReason = "manual" | "tp" | "sl";

const REASON_TRANSACTION_TYPES = ["position_close", "tp", "sl"] as const;

/**
 * status='closed'인 포지션만 TP/SL/수동 청산 구분이 의미 있다(강제청산은 status
 * 자체가 'liquidated'라 따로 조회할 필요 없음). close_position RPC가 p_reason으로
 * transactions.type에 남긴 값('position_close'|'tp'|'sl')을 position_id로 매칭한다.
 * position_id는 jsonb detail 컬럼 안에 있어 JSON 경로 필터 대신, 최근 트랜잭션을
 * 가져와 JS에서 매칭한다(supabase-js가 detail을 이미 파싱된 객체로 반환하므로 간단함).
 */
export async function getCloseReasons(
  supabase: SupabaseClient,
  userId: string,
  positionIds: string[],
): Promise<Map<string, CloseReason>> {
  const map = new Map<string, CloseReason>();
  if (positionIds.length === 0) return map;

  const { data } = await supabase
    .from("transactions")
    .select("type, detail")
    .eq("user_id", userId)
    .in("type", REASON_TRANSACTION_TYPES)
    .order("created_at", { ascending: false })
    .limit(1000);

  const idSet = new Set(positionIds);
  for (const row of data ?? []) {
    const detail = row.detail as { position_id?: string } | null;
    const posId = detail?.position_id;
    if (posId && idSet.has(posId) && !map.has(posId)) {
      map.set(posId, row.type === "position_close" ? "manual" : (row.type as "tp" | "sl"));
    }
  }
  return map;
}
