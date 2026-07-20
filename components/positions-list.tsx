"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { settleCheckAction } from "@/app/actions/trade";
import { PositionCard, SettledNotice } from "@/components/position-card";
import { isLiquidated, unrealizedPnl } from "@/lib/engine";
import { formatSignedKrw, formatSignedUsdt } from "@/lib/format";
import type { OpenPosition } from "@/lib/positions";
import { getUsdtKrw, subscribeMarkPrice, type Symbol } from "@/lib/prices";

const SYMBOLS: Symbol[] = ["BTC-USDT-SWAP", "ETH-USDT-SWAP"];
const KRW_POLL_INTERVAL_MS = 30000;

type AutoSettled = {
  label: string;
  realizedPnl: number;
  realizedKrw: number | null;
};

const REASON_LABEL: Record<string, string> = {
  liquidated: "강제청산됨",
  tp: "TP 도달",
  sl: "SL 도달",
};

export function PositionsList({
  initialPositions,
}: {
  initialPositions: OpenPosition[];
}) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [usdtKrwRate, setUsdtKrwRate] = useState<number | null>(null);
  const [autoSettled, setAutoSettled] = useState<Record<string, AutoSettled>>(
    {},
  );

  const positionsRef = useRef(initialPositions);
  useEffect(() => {
    positionsRef.current = initialPositions;
  }, [initialPositions]);

  // 같은 포지션에 중복으로 settleCheckAction을 호출하지 않기 위한 플래그.
  // 정산 성공 시에도 지우지 않아 재트리거를 막고, 서버가 "아직 아니다"라고
  // 판단해 정산되지 않은 경우에만 지워서 다음 가격 틱에 재시도할 수 있게 한다.
  const settleInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = subscribeMarkPrice(SYMBOLS, (sym, price) => {
      setPrices((p) => ({ ...p, [sym]: price }));

      for (const position of positionsRef.current) {
        if (position.symbol !== sym) continue;
        if (settleInFlight.current.has(position.id)) continue;

        const liquidated = isLiquidated(position.side, position.liq_price, price);
        const tpHit =
          position.tp_price != null &&
          (position.side === "long"
            ? price >= position.tp_price
            : price <= position.tp_price);
        const slHit =
          !tpHit &&
          position.sl_price != null &&
          (position.side === "long"
            ? price <= position.sl_price
            : price >= position.sl_price);

        if (!liquidated && !tpHit && !slHit) continue;

        settleInFlight.current.add(position.id);
        settleCheckAction(position.id).then((result) => {
          if (!result.settled) {
            settleInFlight.current.delete(position.id);
            return;
          }
          setAutoSettled((prev) => ({
            ...prev,
            [position.id]: {
              label: REASON_LABEL[result.reason ?? ""] ?? "정산됨",
              realizedPnl: result.realizedPnl ?? 0,
              realizedKrw: result.realizedKrw ?? null,
            },
          }));
          setTimeout(() => router.refresh(), 2500);
        });
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function fetchRate() {
      try {
        const rate = await getUsdtKrw();
        if (!cancelled) setUsdtKrwRate(rate);
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

  if (initialPositions.length === 0) {
    return (
      <div className="text-center">
        <p className="text-sm text-zinc-400">보유 중인 포지션이 없어요.</p>
        <Link
          href="/dashboard/trade"
          className="mt-4 inline-block rounded-lg bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          트레이드하러 가기
        </Link>
      </div>
    );
  }

  const totalPnl = initialPositions.reduce((sum, p) => {
    const mark = prices[p.symbol];
    if (mark == null) return sum;
    return sum + unrealizedPnl(p.side, p.entry_price, mark, p.qty);
  }, 0);
  const totalPnlKrw = usdtKrwRate != null ? totalPnl * usdtKrwRate : null;
  const pnlColorClass =
    totalPnl > 0
      ? "text-emerald-400"
      : totalPnl < 0
        ? "text-red-400"
        : "text-zinc-50";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <p className="text-xs text-zinc-400">총 미실현 손익</p>
          <p className={`text-lg font-semibold ${pnlColorClass}`}>
            {formatSignedUsdt(totalPnl)}
            {totalPnlKrw != null && (
              <span className="ml-1 text-xs font-normal text-zinc-500">
                ({formatSignedKrw(totalPnlKrw)})
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">오픈 포지션</p>
          <p className="text-lg font-semibold text-zinc-50">
            {initialPositions.length}/5
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {initialPositions.map((p) => {
          const settled = autoSettled[p.id];
          if (settled) {
            return (
              <li key={p.id}>
                <SettledNotice
                  label={settled.label}
                  realizedPnl={settled.realizedPnl}
                  realizedKrw={settled.realizedKrw}
                />
              </li>
            );
          }
          return (
            <PositionCard
              key={p.id}
              position={p}
              markPrice={prices[p.symbol] ?? null}
              usdtKrwRate={usdtKrwRate}
            />
          );
        })}
      </ul>

      <Link
        href="/dashboard/trade"
        className="mt-6 block w-full rounded-lg bg-zinc-100 py-3 text-center text-sm font-semibold text-zinc-900 transition hover:bg-white"
      >
        새 포지션 진입
      </Link>
    </div>
  );
}
