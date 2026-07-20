import { unrealizedPnl, type Side } from "@/lib/engine";
import { getOkxMarkPrice, type Symbol } from "@/lib/prices";
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

async function computeSnapshot(): Promise<RankingSnapshot> {
  const supabase = createServiceClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("user_id, okx_trading_usdt, okx_funding_usdt, upbit_usdt, initial_usdt")
    .gt("initial_usdt", 0);

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

  const entries: InternalEntry[] = rows.map((r) => {
    const margin = marginByUser.get(r.user_id) ?? 0;
    const pnl = pnlByUser.get(r.user_id) ?? 0;
    const totalAssets =
      r.okx_trading_usdt + r.okx_funding_usdt + r.upbit_usdt + margin + pnl;
    const profit = totalAssets - r.initial_usdt;
    const returnPct = (profit / r.initial_usdt) * 100;
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
  cache = await computeSnapshot();
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
