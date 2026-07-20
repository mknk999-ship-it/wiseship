"use client";

import { useState } from "react";

import { formatSignedKrw, formatSignedUsdt } from "@/lib/format";
import type { RankingEntry, RankingView } from "@/lib/ranking";

type Tab = "profit" | "returnRate";

const MEDAL = ["🥇", "🥈", "🥉"];

export function RankingTabs({
  profit,
  returnRate,
  usdtKrwRate,
}: {
  profit: RankingView;
  returnRate: RankingView;
  usdtKrwRate: number | null;
}) {
  const [tab, setTab] = useState<Tab>("profit");
  const active = tab === "profit" ? profit : returnRate;
  const myRankOutsideTop =
    active.myRank != null && !active.top.some((e) => e.isMe);

  return (
    <div>
      <div className="mb-4 flex rounded-lg bg-zinc-800/60 p-1">
        <button
          type="button"
          onClick={() => setTab("profit")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "profit"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          수익금 랭킹
        </button>
        <button
          type="button"
          onClick={() => setTab("returnRate")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "returnRate"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          수익률 랭킹
        </button>
      </div>

      {active.top.length === 0 ? (
        <p className="text-center text-sm text-zinc-400">랭킹 데이터가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {active.top.map((entry) => (
            <RankingRow key={entry.rank} entry={entry} usdtKrwRate={usdtKrwRate} />
          ))}
        </ul>
      )}

      {myRankOutsideTop && active.myRank && (
        <div className="mt-4 rounded-xl border border-zinc-500 bg-zinc-800 p-3 text-center text-sm font-medium text-zinc-100">
          내 순위: {active.myRank.rank}위
        </div>
      )}
    </div>
  );
}

function RankingRow({
  entry,
  usdtKrwRate,
}: {
  entry: RankingEntry;
  usdtKrwRate: number | null;
}) {
  const krw = usdtKrwRate != null ? entry.profit * usdtKrwRate : null;
  const medal = entry.rank <= 3 ? MEDAL[entry.rank - 1] : null;
  const profitColorClass =
    entry.profit > 0
      ? "text-emerald-400"
      : entry.profit < 0
        ? "text-red-400"
        : "text-zinc-50";

  return (
    <li
      className={`flex items-center justify-between rounded-xl border p-3 ${
        entry.isMe
          ? "border-zinc-400 bg-zinc-800"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-sm font-semibold text-zinc-400">
          {medal ?? entry.rank}
        </span>
        <span className="text-sm font-medium text-zinc-50">
          {entry.nickname}
          {entry.isMe && <span className="ml-1 text-xs text-zinc-400">(나)</span>}
        </span>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${profitColorClass}`}>
          {formatSignedUsdt(entry.profit)}
        </p>
        <p className="text-xs text-zinc-500">
          {krw != null && `${formatSignedKrw(krw)} · `}
          {entry.returnPct > 0 ? "+" : ""}
          {entry.returnPct.toFixed(2)}%
        </p>
      </div>
    </li>
  );
}
