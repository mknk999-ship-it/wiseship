"use client";

import { useState } from "react";

import { updateClosedPositionSl } from "@/app/actions/trade";
import { errorBoxClassName, inputClassName } from "@/components/ui";
import { unrealizedPnl, type Side } from "@/lib/engine";
import { profitLossRatio } from "@/lib/trade";

/**
 * 손익비는 진입가 대비 TP/SL까지의 '거리' 비율이라 qty 크기와 무관하다(같은 qty로
 * 나눠져 상쇄됨). TP/SL 편집 카드(position-card.tsx)와 동일하게 unrealizedPnl +
 * profitLossRatio를 그대로 재사용하되, qty는 비율에 영향 없는 고정값(1)을 넣는다.
 */
export function ClosedPositionRatio({
  positionId,
  side,
  entryPrice,
  tpPrice,
  slPrice,
}: {
  positionId: string;
  side: Side;
  entryPrice: number;
  tpPrice: number | null;
  slPrice: number | null;
}) {
  const [sl, setSl] = useState(slPrice);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedProfit =
    tpPrice != null ? unrealizedPnl(side, entryPrice, tpPrice, 1) : null;
  const expectedLoss = sl != null ? unrealizedPnl(side, entryPrice, sl, 1) : null;
  const ratio = profitLossRatio(expectedProfit, expectedLoss);

  async function handleSave() {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("올바른 가격을 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await updateClosedPositionSl(positionId, parsed);
    setPending(false);

    if (!res.success) {
      setError(res.error ?? "저장에 실패했습니다.");
      return;
    }
    setSl(res.slPrice ?? parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="SL 가격"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
            className={`${inputClassName} py-1.5 text-xs`}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="shrink-0 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={pending}
            className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60"
          >
            취소
          </button>
        </div>
        {error && <p className={errorBoxClassName}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
      <span>손익비</span>
      {sl == null ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/30"
        >
          SL 미입력
        </button>
      ) : ratio != null ? (
        <span className="font-semibold">
          <span className="text-emerald-400">{ratio.toFixed(1)}</span>
          <span className="text-red-400"> : 1</span>
        </span>
      ) : (
        <span className="text-zinc-500">— (TP 미지정)</span>
      )}
    </div>
  );
}
