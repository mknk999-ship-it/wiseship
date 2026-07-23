import { unrealizedPnl, type Side } from "@/lib/engine";
import { calcTotalEquity } from "@/lib/equity";
import { INITIAL_MARGIN_KRW } from "@/lib/margin";
import { getOkxMarkPrice, getUsdtKrw, type Symbol } from "@/lib/prices";
import { createServiceClient } from "@/lib/supabase/service";

const CACHE_TTL_MS = 30_000;
const TOP_N = 50;

export type RankingEntry = {
  rank: number;
  nickname: string;
  profit: number;
  returnPct: number;
  totalAssets: number;
  isMe: boolean;
};

export type RankingView = {
  top: RankingEntry[];
  myRank: RankingEntry | null;
};

type InternalEntry = {
  userId: string;
  nickname: string;
  profit: number;
  returnPct: number;
  totalAssets: number;
};

type RankingSnapshot = {
  byProfit: InternalEntry[];
  byReturn: InternalEntry[];
  computedAt: number;
};

let cache: RankingSnapshot | null = null;

async function computeSnapshot(): Promise<RankingSnapshot | null> {
  // 전체 계정을 한 스냅샷으로 원화 환산하므로 유저별이 아니라 딱 한 번만 조회한다.
  // 실패하면 이번 스냅샷 계산 자체를 포기하고(null), 호출부가 기존 캐시를 그대로 쓴다.
  let rate: number;
  try {
    rate = await getUsdtKrw();
  } catch {
    return null;
  }

  const supabase = createServiceClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("user_id, okx_trading_usdt, okx_funding_usdt, upbit_usdt, upbit_krw, initial_krw")
    .gt("initial_krw", 0);

  const rows = accounts ?? [];
  if (rows.length === 0) {
    return { byProfit: [], byReturn: [], computedAt: Date.now() };
  }

  const userIds = rows.map((r) => r.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname")
    .in("id", userIds);

  const nicknameByUser = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id, p.nickname as string]),
  );

  const { data: positions } = await supabase
    .from("positions")
    .select("user_id, symbol, side, margin, qty, entry_price")
    .eq("status", "open")
    .in("user_id", userIds);

  const openPositions = (positions ?? []) as {
    user_id: string;
    symbol: Symbol;
    side: Side;
    margin: number;
    qty: number;
    entry_price: number;
  }[];

  const uniqueSymbols = Array.from(new Set(openPositions.map((p) => p.symbol)));
  const markPrices = new Map<Symbol, number>();
  for (const symbol of uniqueSymbols) {
    try {
      markPrices.set(symbol, await getOkxMarkPrice(symbol));
    } catch {
      // 조회 실패한 심볼의 포지션은 미실현손익을 0으로 취급 (증거금만 총자산에 반영)
    }
  }

  const marginByUser = new Map<string, number>();
  const pnlByUser = new Map<string, number>();
  for (const p of openPositions) {
    marginByUser.set(p.user_id, (marginByUser.get(p.user_id) ?? 0) + p.margin);
    const mark = markPrices.get(p.symbol);
    if (mark != null) {
      const pnl = unrealizedPnl(p.side, p.entry_price, mark, p.qty);
      pnlByUser.set(p.user_id, (pnlByUser.get(p.user_id) ?? 0) + pnl);
    }
  }

  // 총자산은 원화로 환산해 계산한다: 전원 기준값이 고정 1,000만원(INITIAL_MARGIN_KRW)이고,
  // 온보딩 직후에는 자산 대부분이 upbit_krw(원화 미전환)에 머무를 수 있어 USDT 컬럼 합만
  // 보면 총자산이 0으로 잡히는 문제가 있었다. USDT 쪽 합계는 기존과 동일하게
  // calcTotalEquity로 구한 뒤, 그 순간의 환율로 원화 환산해 upbit_krw와 합산한다.
  const entries: InternalEntry[] = rows.map((r) => {
    const margin = marginByUser.get(r.user_id) ?? 0;
    const pnl = pnlByUser.get(r.user_id) ?? 0;
    const totalEquityUsdt = calcTotalEquity({
      walletBalance: r.okx_trading_usdt + r.okx_funding_usdt + r.upbit_usdt,
      totalMargin: margin,
      totalUnrealizedPnl: pnl,
    });
    const totalAssets = r.upbit_krw + totalEquityUsdt * rate;
    const profit = totalAssets - INITIAL_MARGIN_KRW;
    const returnPct = (profit / INITIAL_MARGIN_KRW) * 100;
    return {
      userId: r.user_id,
      nickname: nicknameByUser.get(r.user_id) ?? "익명",
      profit,
      returnPct,
      totalAssets,
    };
  });

  return {
    byProfit: [...entries].sort((a, b) => b.profit - a.profit),
    byReturn: [...entries].sort((a, b) => b.returnPct - a.returnPct),
    computedAt: Date.now(),
  };
}

async function getSnapshot(): Promise<RankingSnapshot> {
  if (cache && Date.now() - cache.computedAt < CACHE_TTL_MS) {
    return cache;
  }
  const fresh = await computeSnapshot();
  if (fresh) {
    cache = fresh;
  } else if (!cache) {
    cache = { byProfit: [], byReturn: [], computedAt: Date.now() };
  }
  return cache;
}

function toRankingView(
  list: InternalEntry[],
  currentUserId: string | null,
): RankingView {
  const top: RankingEntry[] = list.slice(0, TOP_N).map((e, i) => ({
    rank: i + 1,
    nickname: e.nickname,
    profit: e.profit,
    returnPct: e.returnPct,
    totalAssets: e.totalAssets,
    isMe: e.userId === currentUserId,
  }));

  let myRank: RankingEntry | null = null;
  if (currentUserId) {
    const idx = list.findIndex((e) => e.userId === currentUserId);
    if (idx !== -1) {
      const e = list[idx];
      myRank = {
        rank: idx + 1,
        nickname: e.nickname,
        profit: e.profit,
        returnPct: e.returnPct,
        totalAssets: e.totalAssets,
        isMe: true,
      };
    }
  }

  return { top, myRank };
}

export async function getRankings(
  currentUserId: string | null,
): Promise<{ profit: RankingView; returnRate: RankingView }> {
  const snapshot = await getSnapshot();
  return {
    profit: toRankingView(snapshot.byProfit, currentUserId),
    returnRate: toRankingView(snapshot.byReturn, currentUserId),
  };
}
