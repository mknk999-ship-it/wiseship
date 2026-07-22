import { roePercent } from "@/lib/engine";
import {
  formatDateTime,
  formatSignedUsdt,
  formatSymbol,
  pnlColorClass,
} from "@/lib/format";
import type { ClosedPosition, CloseReason } from "@/lib/positions";

type Reason = CloseReason | "liquidated";

const REASON_LABEL: Record<Reason, string> = {
  manual: "수동 청산",
  tp: "TP",
  sl: "SL",
  liquidated: "강제청산",
};

const REASON_BADGE_CLASS: Record<Reason, string> = {
  manual: "bg-zinc-700 text-zinc-200",
  tp: "bg-emerald-500/20 text-emerald-400",
  sl: "bg-orange-500/20 text-orange-400",
  liquidated: "bg-red-500/20 text-red-400",
};

export function ClosedPositionCard({
  position,
  reason,
}: {
  position: ClosedPosition;
  reason: Reason;
}) {
  const pnl = position.realized_pnl ?? 0;
  const roe = roePercent(pnl, position.margin);
  const colorClass = pnlColorClass(pnl);

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-50">
            {formatSymbol(position.symbol)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              position.side === "long"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {position.side === "long" ? "롱" : "숏"} {position.leverage}x
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REASON_BADGE_CLASS[reason]}`}
        >
          {REASON_LABEL[reason]}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-xs text-zinc-400">실현 손익</p>
          <p className={`text-base font-semibold ${colorClass}`}>
            {formatSignedUsdt(pnl)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="whitespace-nowrap text-xs text-zinc-400">수익률</p>
          <p className={`text-base font-semibold ${colorClass}`}>
            {roe > 0 ? "+" : ""}
            {roe.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="min-w-0">
          {position.entry_price.toLocaleString("ko-KR", {
            maximumFractionDigits: 2,
          })}
          {" → "}
          {position.close_price != null
            ? position.close_price.toLocaleString("ko-KR", {
                maximumFractionDigits: 2,
              })
            : "—"}
        </span>
        <span className="shrink-0 whitespace-nowrap">
          {formatDateTime(position.closed_at)}
        </span>
      </div>
    </li>
  );
}
