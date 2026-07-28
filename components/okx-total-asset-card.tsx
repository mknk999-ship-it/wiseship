"use client";

import { useEffect, useState } from "react";

import { unrealizedPnl, type Side } from "@/lib/engine";
import { calcTotalEquity } from "@/lib/equity";
import {
  formatKrw,
  formatSignedKrw,
  formatSignedUsdt,
  formatUsdt,
  pnlColorClass,
} from "@/lib/format";
import { getUsdtKrw, subscribeMarkPrice, type Symbol } from "@/lib/prices";

const KRW_POLL_INTERVAL_MS = 30000;

type PositionInput = {
  symbol: Symbol;
  side: Side;
  margin: number;
  qty: number;
  entry_price: number;
};

function UsdtRow({
  label,
  usdt,
  rate,
}: {
  label: string;
  usdt: number;
  rate: number | null;
}) {
  const krw = rate != null ? usdt * rate : null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 whitespace-nowrap text-zinc-400">{label}</span>
      <span className="min-w-0 text-right">
        <span className="font-medium tabular-nums text-zinc-300">
          {formatUsdt(usdt)}
        </span>
        {krw != null && (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            ({formatKrw(krw)})
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * OKX 총자산 = 펀딩+트레이딩 잔고 + Σ(포지션별 증거금 + 미실현손익).
 * calcTotalEquity(lib/equity.ts)로 계산하며, 이는 랭킹(lib/ranking.ts)이 전 유저
 * 총자산을 환산할 때 쓰는 것과 동일한 공식이다. 미실현손익만 마크가격이 실시간으로
 * 바뀌므로, 이 카드는 클라이언트에서 subscribeMarkPrice로 직접 구독해 갱신한다.
 */
export function OkxTotalAssetCard({
  okxFunding,
  okxTrading,
  positions,
  initialRate,
}: {
  okxFunding: number;
  okxTrading: number;
  positions: PositionInput[];
  initialRate: number | null;
}) {
  const [prices, setPrices] = useState<Partial<Record<Symbol, number>>>({});
  const [rate, setRate] = useState<number | null>(initialRate);

  const symbolsKey = Array.from(new Set(positions.map((p) => p.symbol))).join(
    ",",
  );

  useEffect(() => {
    const symbols = symbolsKey ? (symbolsKey.split(",") as Symbol[]) : [];
    if (symbols.length === 0) return;
    const unsubscribe = subscribeMarkPrice(symbols, (sym, price) => {
      setPrices((p) => ({ ...p, [sym]: price }));
    });
    return unsubscribe;
  }, [symbolsKey]);

  useEffect(() => {
    let cancelled = false;
    async function fetchRate() {
      try {
        const r = await getUsdtKrw();
        if (!cancelled) setRate(r);
      } catch {
        // 실패 시 마지막으로 알려진 환율을 그대로 유지
      }
    }
    fetchRate();
    const interval = setInterval(fetchRate, KRW_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const totalMargin = positions.reduce((sum, p) => sum + p.margin, 0);
  const totalUnrealizedPnl = positions.reduce((sum, p) => {
    const mark = prices[p.symbol];
    if (mark == null) return sum;
    return sum + unrealizedPnl(p.side, p.entry_price, mark, p.qty);
  }, 0);

  const okxWalletUsdt = okxFunding + okxTrading;
  const okxTotalEquity = calcTotalEquity({
    walletBalance: okxWalletUsdt,
    totalMargin,
    totalUnrealizedPnl,
  });
  const okxTotalEquityKrw = rate != null ? okxTotalEquity * rate : null;
  const pnlKrw = rate != null ? totalUnrealizedPnl * rate : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-zinc-400">
        OKX 총자산
      </p>
      <p className="mt-1 break-words text-2xl font-bold tabular-nums text-white">
        {formatUsdt(okxTotalEquity)}
        {okxTotalEquityKrw != null && (
          <span className="ml-1 text-base font-normal text-zinc-400">
            ({formatKrw(okxTotalEquityKrw)})
          </span>
        )}
      </p>
      <div className="mt-3 space-y-1.5">
        <UsdtRow label="Funding" usdt={okxFunding} rate={rate} />
        <UsdtRow label="Trading" usdt={okxTrading} rate={rate} />
        {positions.length > 0 && (
          <>
            <UsdtRow label="포지션 증거금" usdt={totalMargin} rate={rate} />
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="shrink-0 whitespace-nowrap text-zinc-400">
                미실현 손익
              </span>
              <span
                className={`min-w-0 text-right font-medium tabular-nums ${pnlColorClass(totalUnrealizedPnl)}`}
              >
                {formatSignedUsdt(totalUnrealizedPnl)}
                {pnlKrw != null && (
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    ({formatSignedKrw(pnlKrw)})
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
