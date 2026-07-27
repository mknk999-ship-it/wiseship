"use client";

import { useId, useState } from "react";

import { updatePositionNote } from "@/app/actions/trade";
import { errorBoxClassName, inputClassName } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export function PositionNote({
  positionId,
  entryReason,
  slReason,
  tpReason,
  exitReview,
  noteUpdatedAt,
  showExitReview,
}: {
  positionId: string;
  entryReason: string | null;
  slReason: string | null;
  tpReason: string | null;
  exitReview: string | null;
  noteUpdatedAt: string | null;
  showExitReview: boolean;
}) {
  const idPrefix = useId();
  const [open, setOpen] = useState(false);
  const [entryInput, setEntryInput] = useState(entryReason ?? "");
  const [slInput, setSlInput] = useState(slReason ?? "");
  const [tpInput, setTpInput] = useState(tpReason ?? "");
  const [reviewInput, setReviewInput] = useState(exitReview ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string }>({});
  const [updatedAt, setUpdatedAt] = useState(noteUpdatedAt);

  const hasNote = Boolean(
    entryReason?.trim() ||
      slReason?.trim() ||
      tpReason?.trim() ||
      (showExitReview && exitReview?.trim()),
  );

  async function handleSave() {
    setPending(true);
    setResult({});
    // 화면에 숨겨진 필드(예: 보유 포지션 카드의 exit_review)도 현재 값을 그대로
    // 실어 보낸다 — RPC가 4개 필드를 통째로 덮어쓰므로 그렇지 않으면 다른 화면에서
    // 이미 적어둔 값이 지워진다.
    const res = await updatePositionNote(positionId, {
      entryReason: entryInput.trim() === "" ? null : entryInput,
      slReason: slInput.trim() === "" ? null : slInput,
      tpReason: tpInput.trim() === "" ? null : tpInput,
      exitReview: reviewInput.trim() === "" ? null : reviewInput,
    });
    setPending(false);

    if (res.success) {
      setResult({ success: true });
      setUpdatedAt(res.noteUpdatedAt ?? null);
    } else {
      setResult({ error: res.error ?? "저장에 실패했습니다." });
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-200"
      >
        <span className="flex items-center gap-1.5">
          메모
          {hasNote && <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />}
        </span>
        <span className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[11px] text-zinc-600">
              마지막 수정 {formatDateTime(updatedAt)}
            </span>
          )}
          <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-zinc-800 p-3">
          <NoteField
            id={`${idPrefix}-entry`}
            label="진입 이유"
            value={entryInput}
            onChange={setEntryInput}
          />
          <NoteField
            id={`${idPrefix}-sl`}
            label="SL 이유"
            value={slInput}
            onChange={setSlInput}
          />
          <NoteField
            id={`${idPrefix}-tp`}
            label="TP 이유"
            value={tpInput}
            onChange={setTpInput}
          />
          {showExitReview && (
            <NoteField
              id={`${idPrefix}-review`}
              label="종료 후 복기"
              value={reviewInput}
              onChange={setReviewInput}
            />
          )}

          {result.error && <p className={errorBoxClassName}>{result.error}</p>}
          {result.success && (
            <p className="text-xs text-emerald-400">저장했습니다.</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="w-full rounded-lg bg-zinc-100 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
    </div>
  );
}

function NoteField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-zinc-400">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClassName} resize-none`}
      />
    </div>
  );
}
