"use client";

import { useActionState, useEffect, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";

import {
  cancelPositionTpSl,
  closePositionAction,
  setPositionTpSl,
  type CancelTpSlTarget,
  type CloseState,
  type TpSlState,
} from "@/app/actions/trade";
import { PositionNote } from "@/components/position-note";
import { PriceChart } from "@/components/price-chart";
import { errorBoxClassName, inputClassName } from "@/components/ui";
import { closePosition, roePercent, toKrw, unrealizedPnl, type Side } from "@/lib/engine";
import {
  formatDateTime,
  formatKrw,
  formatQty,
  formatSignedKrw,
  formatSignedUsdt,
  formatSymbol,
  formatUsdt,
  pnlColorClass,
} from "@/lib/format";
import type { OpenPosition } from "@/lib/positions";
import {
  CLOSE_RATIOS,
  profitLossRatio,
  resolvePartialClose,
  validateTpSl,
  type CloseRatio,
} from "@/lib/trade";

export type CloseResult = {
  isFullClose: boolean;
  remainingQty: number | null;
  remainingMargin: number | null;
  realizedPnl: number;
  realizedKrw: number | null;
  closeRatio: number;
};

const LIQ_WARNING_THRESHOLD = 5;
const initialState: CloseState = {};
const initialTpSlState: TpSlState = {};

export function PositionCard({
  position,
  markPrice,
  usdtKrwRate,
  onClosed,
  onTpSlCancelled,
  onTpSlCancelError,
}: {
  position: OpenPosition;
  markPrice: number | null;
  usdtKrwRate: number | null;
  onClosed: (position: OpenPosition, result: CloseResult) => void;
  onTpSlCancelled: (
    positionId: string,
    patch: { tp_price: number | null; sl_price: number | null },
  ) => void;
  onTpSlCancelError: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    closePositionAction,
    initialState,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tpSlModalOpen, setTpSlModalOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [closeRatio, setCloseRatio] = useState<CloseRatio>(1);
  const [optimisticClose, setOptimisticClose] = useOptimistic<
    { qty: number; margin: number } | null
  >(null);
  const [cancelPending, setCancelPending] = useState<CancelTpSlTarget | null>(
    null,
  );

  async function handleCancelTpSl(target: CancelTpSlTarget) {
    setCancelPending(target);
    const result = await cancelPositionTpSl(position.id, target);
    setCancelPending(null);
    if (result.success) {
      onTpSlCancelled(position.id, {
        tp_price: result.tpPrice ?? null,
        sl_price: result.slPrice ?? null,
      });
    } else {
      onTpSlCancelError(result.error ?? "요청을 처리하는 중 오류가 발생했습니다.");
    }
  }

  // 부모에 종료 결과를 알리는 것은 외부(다른 컴포넌트) 상태를 건드리는 진짜
  // side effect라 useEffect가 맞다. state 객체 전체를 의존성으로 둬서, 같은
  // 카드에서 연속으로 부분 종료할 때도(매번 새 state 객체) 매번 정확히 한 번씩 알린다.
  useEffect(() => {
    if (!state.success) return;
    onClosed(position, {
      isFullClose: state.isFullClose ?? true,
      remainingQty: state.remainingQty ?? null,
      remainingMargin: state.remainingMargin ?? null,
      realizedPnl: state.realizedPnl ?? 0,
      realizedKrw: state.realizedKrw ?? null,
      closeRatio: state.closeRatio ?? 1,
    });
    // position/onClosed는 성공 시점의 값을 한 번만 반영하면 되므로 의도적으로 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // 종료 확인 패널 닫기는 로컬 렌더 상태 조정이라 effect보다 렌더 중 비교가
  // 더 적합하다 (React 공식 권장 패턴: "Adjusting state when a prop changes").
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setConfirmOpen(false);
  }

  function handleCloseSubmit(formData: FormData) {
    const resolved = resolvePartialClose(position.qty, position.margin, closeRatio);
    setOptimisticClose({
      qty: resolved.isFullClose ? 0 : position.qty - resolved.closedQty,
      margin: resolved.isFullClose ? 0 : position.margin - resolved.closedMargin,
    });
    formAction(formData);
  }

  const displayQty = optimisticClose?.qty ?? position.qty;
  const displayMargin = optimisticClose?.margin ?? position.margin;

  const pnl =
    markPrice != null
      ? unrealizedPnl(position.side, position.entry_price, markPrice, displayQty)
      : null;
  const roe = pnl != null && displayMargin > 0 ? roePercent(pnl, displayMargin) : null;
  const pnlKrw =
    pnl != null && usdtKrwRate != null ? pnl * usdtKrwRate : null;
  const marginKrw =
    usdtKrwRate != null ? toKrw(displayMargin, usdtKrwRate) : null;
  const positionValue = markPrice != null ? displayQty * markPrice : null;
  const positionValueKrw =
    positionValue != null && usdtKrwRate != null
      ? positionValue * usdtKrwRate
      : null;

  const closeMarginPreview = position.margin * closeRatio;
  const closePreview =
    markPrice != null
      ? closePosition(
          position.side,
          position.entry_price,
          markPrice,
          position.qty * closeRatio,
          closeMarginPreview,
        )
      : null;

  // 지금 종료 시 손익비: SL이 설정된 경우에만 계산 (예상이익=현재가 기준, 예상손실=SL 도달 시 손실 크기).
  const expectedProfitNow = pnl;
  const expectedLossNow =
    position.sl_price != null
      ? -unrealizedPnl(position.side, position.entry_price, position.sl_price, displayQty)
      : null;
  const closeRatioNow = profitLossRatio(expectedProfitNow, expectedLossNow);

  const liqDistance =
    markPrice != null
      ? (Math.abs(markPrice - position.liq_price) / markPrice) * 100
      : null;
  const nearLiquidation =
    liqDistance != null && liqDistance <= LIQ_WARNING_THRESHOLD;

  const pnlColorClassValue = pnl == null ? "text-zinc-50" : pnlColorClass(pnl);

  return (
    <li
      className={`rounded-xl border p-4 ${
        nearLiquidation
          ? "border-amber-600 bg-amber-950/20"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="flex items-center justify-between">
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

      <div className="mt-3 grid grid-cols-2 items-center gap-y-1.5 text-xs text-zinc-400">
        <span className="shrink-0 whitespace-nowrap">진입 시간</span>
        <span className="min-w-0 text-right text-zinc-200">
          {formatDateTime(position.opened_at)}
        </span>
        <span className="shrink-0 whitespace-nowrap">진입가</span>
        <span className="min-w-0 text-right text-zinc-200">
          {position.entry_price.toLocaleString("ko-KR", {
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="shrink-0 whitespace-nowrap">현재가</span>
        <span className="min-w-0 text-right text-zinc-200">
          {markPrice != null
            ? markPrice.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
            : "불러오는 중..."}
        </span>
        <span className="shrink-0 whitespace-nowrap">수량</span>
        <span className="min-w-0 text-right text-zinc-200">
          {formatQty(displayQty)}
        </span>
        <span className="shrink-0 whitespace-nowrap">평가금액</span>
        <span className="min-w-0 text-right leading-tight text-zinc-200">
          {positionValue != null ? (
            <>
              <span className="block">{formatUsdt(positionValue)}</span>
              {positionValueKrw != null && (
                <span className="block text-[11px] text-zinc-500">
                  {formatKrw(positionValueKrw)}
                </span>
              )}
            </>
          ) : (
            "계산 중..."
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap">증거금</span>
        <span className="min-w-0 text-right leading-tight text-zinc-200">
          <span className="block">{formatUsdt(displayMargin)}</span>
          {marginKrw != null && (
            <span className="block text-[11px] text-zinc-500">
              {formatKrw(marginKrw)}
            </span>
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-950/40 p-3">
        <div className="min-w-0">
          <p className="shrink-0 whitespace-nowrap text-xs text-zinc-400">미실현 손익</p>
          <p className={`text-base font-semibold ${pnlColorClassValue}`}>
            {pnl != null ? formatSignedUsdt(pnl) : "계산 중..."}
            {pnlKrw != null && (
              <span className="ml-1 text-xs font-normal text-zinc-500">
                ({formatSignedKrw(pnlKrw)})
              </span>
            )}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="whitespace-nowrap text-xs text-zinc-400">ROE</p>
          <p className={`text-base font-semibold ${pnlColorClassValue}`}>
            {roe != null ? `${roe > 0 ? "+" : ""}${roe.toFixed(2)}%` : "-"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-bold text-amber-400">
          청산가 {position.liq_price.toLocaleString("ko-KR", {
            maximumFractionDigits: 2,
          })}
        </span>
        {liqDistance != null && (
          <span
            className={
              nearLiquidation
                ? "font-semibold text-amber-400"
                : "text-zinc-500"
            }
          >
            {nearLiquidation && "⚠ "}
            거리 {liqDistance.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          TP{" "}
          <span className="text-zinc-300">
            {position.tp_price != null
              ? position.tp_price.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
          {position.tp_price != null && (
            <button
              type="button"
              onClick={() => handleCancelTpSl("tp")}
              disabled={cancelPending != null}
              aria-label="TP 해제"
              className="flex h-4 w-4 items-center justify-center rounded text-zinc-500 transition hover:text-red-300 disabled:opacity-40"
            >
              {cancelPending === "tp" ? (
                <span className="block h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
              ) : (
                "✕"
              )}
            </button>
          )}
        </span>
        <span className="flex items-center gap-1">
          SL{" "}
          <span className="text-zinc-300">
            {position.sl_price != null
              ? position.sl_price.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
          {position.sl_price != null && (
            <button
              type="button"
              onClick={() => handleCancelTpSl("sl")}
              disabled={cancelPending != null}
              aria-label="SL 해제"
              className="flex h-4 w-4 items-center justify-center rounded text-zinc-500 transition hover:text-red-300 disabled:opacity-40"
            >
              {cancelPending === "sl" ? (
                <span className="block h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
              ) : (
                "✕"
              )}
            </button>
          )}
        </span>
      </div>

      {position.tp_price != null && position.sl_price != null && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => handleCancelTpSl("both")}
            disabled={cancelPending != null}
            className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-red-300 disabled:opacity-40"
          >
            {cancelPending === "both" && (
              <span className="block h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
            )}
            전체 해제
          </button>
        </div>
      )}

      {tpSlModalOpen ? (
        <TpSlEditor
          position={position}
          markPrice={markPrice}
          usdtKrwRate={usdtKrwRate}
          onClose={() => setTpSlModalOpen(false)}
        />
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setTpSlModalOpen(true)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600"
          >
            TP/SL 설정
          </button>
          <button
            type="button"
            onClick={() => setChartOpen(true)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600"
          >
            차트 보기
          </button>
        </div>
      )}

      {chartOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setChartOpen(false)}
          />
          <div className="relative w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-50">
                {formatSymbol(position.symbol)} 차트
              </span>
              <button
                type="button"
                onClick={() => setChartOpen(false)}
                aria-label="차트 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:text-zinc-100"
              >
                ✕
              </button>
            </div>
            <PriceChart
              symbol={position.symbol}
              markPrice={markPrice}
              positions={[position]}
            />
          </div>
        </div>
      )}

      <PositionNote
        positionId={position.id}
        entryReason={position.entry_reason}
        slReason={position.sl_reason}
        tpReason={position.tp_reason}
        exitReview={position.exit_review}
        noteUpdatedAt={position.note_updated_at}
        showExitReview={false}
      />

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
        <span>지금 종료 시 손익비</span>
        {position.sl_price == null ? (
          <span className="font-semibold text-zinc-500">SL 미지정</span>
        ) : closeRatioNow != null ? (
          <span className="font-semibold">
            <span className="text-emerald-400">{closeRatioNow.toFixed(1)}</span>
            <span className="text-red-400"> : 1</span>
          </span>
        ) : (
          <span className="font-semibold text-zinc-200">계산 중...</span>
        )}
      </div>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-red-800 hover:text-red-300"
        >
          포지션 종료
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
          <p className="text-center text-sm font-medium text-zinc-100">
            포지션 종료
          </p>

          <div className="grid grid-cols-2 items-center gap-y-1.5 text-xs text-zinc-400">
            <span>진입가</span>
            <span className="text-right text-zinc-200">
              {position.entry_price.toLocaleString("ko-KR", {
                maximumFractionDigits: 2,
              })}
            </span>
            <span>현재가</span>
            <span className="text-right text-zinc-200">
              {markPrice != null
                ? markPrice.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
                : "불러오는 중..."}
            </span>
            <span>증거금</span>
            <span className="text-right text-zinc-200">
              {formatUsdt(closeMarginPreview)}
            </span>
            <span>예상손익</span>
            <span
              className={`text-right font-semibold ${
                closePreview ? pnlColorClass(closePreview.realized) : "text-zinc-200"
              }`}
            >
              {closePreview ? formatSignedUsdt(closePreview.realized) : "계산 중..."}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {CLOSE_RATIOS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setCloseRatio(ratio)}
                className={`rounded-md py-1.5 text-xs font-semibold transition ${
                  closeRatio === ratio
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {ratio * 100}%
              </button>
            ))}
          </div>

          <form action={handleCloseSubmit} className="flex gap-2">
            <input type="hidden" name="positionId" value={position.id} />
            <input type="hidden" name="closeRatio" value={closeRatio} />
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-zinc-950 hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "처리 중..." : "종료 확정"}
            </button>
          </form>
        </div>
      )}

      {state.error && <p className={`mt-2 ${errorBoxClassName}`}>{state.error}</p>}
    </li>
  );
}

function TpSlEditor({
  position,
  markPrice,
  usdtKrwRate,
  onClose,
}: {
  position: OpenPosition;
  markPrice: number | null;
  usdtKrwRate: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tpSlState, tpSlFormAction, tpSlPending] = useActionState(
    setPositionTpSl,
    initialTpSlState,
  );
  const [tpInput, setTpInput] = useState(
    position.tp_price != null ? String(position.tp_price) : "",
  );
  const [slInput, setSlInput] = useState(
    position.sl_price != null ? String(position.sl_price) : "",
  );

  useEffect(() => {
    if (tpSlState.success) {
      onClose();
      router.refresh();
    }
  }, [tpSlState.success, onClose, router]);

  const tpValue = tpInput === "" ? null : Number(tpInput);
  const slValue = slInput === "" ? null : Number(slInput);
  const side: Side = position.side;
  const tpSlCheck =
    markPrice != null
      ? validateTpSl(side, markPrice, position.liq_price, tpValue, slValue)
      : {};
  const tpPreviewPnl =
    tpValue != null
      ? unrealizedPnl(side, position.entry_price, tpValue, position.qty)
      : null;
  const slPreviewPnl =
    slValue != null
      ? unrealizedPnl(side, position.entry_price, slValue, position.qty)
      : null;
  const tpPreviewKrw =
    tpPreviewPnl != null && usdtKrwRate != null
      ? toKrw(tpPreviewPnl, usdtKrwRate)
      : null;
  const slPreviewKrw =
    slPreviewPnl != null && usdtKrwRate != null
      ? toKrw(slPreviewPnl, usdtKrwRate)
      : null;
  const validExpectedProfit =
    tpValue != null && !tpSlCheck.tpError ? tpPreviewPnl : null;
  const validExpectedLoss =
    slValue != null && !tpSlCheck.slError ? slPreviewPnl : null;
  const tpSlRatio = profitLossRatio(validExpectedProfit, validExpectedLoss);

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor={`tp-${position.id}`} className="text-xs text-zinc-400">
            TP
          </label>
          <button
            type="button"
            onClick={() => setTpInput("")}
            className="text-xs text-zinc-500 hover:text-red-300"
          >
            삭제
          </button>
        </div>
        <input
          id={`tp-${position.id}`}
          type="text"
          inputMode="decimal"
          placeholder="익절가"
          value={tpInput}
          onChange={(e) => setTpInput(e.target.value.replace(/[^0-9.]/g, ""))}
          className={inputClassName}
        />
        {tpPreviewPnl != null && !tpSlCheck.tpError && (
          <p className={`mt-1 text-xs ${pnlColorClass(tpPreviewPnl, "text-zinc-500")}`}>
            도달 시 {formatSignedUsdt(tpPreviewPnl)}
            {tpPreviewKrw != null && (
              <span className="ml-1">({formatSignedKrw(tpPreviewKrw)})</span>
            )}
          </p>
        )}
        {tpSlCheck.tpError && (
          <p className="mt-1 text-xs text-red-400">{tpSlCheck.tpError}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor={`sl-${position.id}`} className="text-xs text-zinc-400">
            SL
          </label>
          <button
            type="button"
            onClick={() => setSlInput("")}
            className="text-xs text-zinc-500 hover:text-red-300"
          >
            삭제
          </button>
        </div>
        <input
          id={`sl-${position.id}`}
          type="text"
          inputMode="decimal"
          placeholder="손절가"
          value={slInput}
          onChange={(e) => setSlInput(e.target.value.replace(/[^0-9.]/g, ""))}
          className={inputClassName}
        />
        {slPreviewPnl != null && !tpSlCheck.slError && (
          <p className={`mt-1 text-xs ${pnlColorClass(slPreviewPnl, "text-zinc-500")}`}>
            도달 시 {formatSignedUsdt(slPreviewPnl)}
            {slPreviewKrw != null && (
              <span className="ml-1">({formatSignedKrw(slPreviewKrw)})</span>
            )}
          </p>
        )}
        {tpSlCheck.slError && (
          <p className="mt-1 text-xs text-red-400">{tpSlCheck.slError}</p>
        )}
        {!tpSlCheck.slError && tpSlCheck.liqWarning && (
          <p className="mt-1 text-xs text-amber-400">⚠ {tpSlCheck.liqWarning}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-zinc-950/40 px-3 py-2 text-xs">
        <span className="text-zinc-400">손익비</span>
        <span className="font-semibold text-zinc-200">
          {tpSlRatio != null ? `${tpSlRatio.toFixed(1)} : 1` : "−"}
        </span>
      </div>

      {tpSlState.error && <p className={errorBoxClassName}>{tpSlState.error}</p>}

      <form action={tpSlFormAction} className="flex gap-2">
        <input type="hidden" name="positionId" value={position.id} />
        <input type="hidden" name="tpPrice" value={tpValue ?? ""} />
        <input type="hidden" name="slPrice" value={slValue ?? ""} />
        <button
          type="button"
          onClick={onClose}
          disabled={tpSlPending}
          className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={tpSlPending || !!tpSlCheck.tpError || !!tpSlCheck.slError}
          className="flex-1 rounded-lg bg-zinc-100 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {tpSlPending ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}

export function SettledNotice({
  label,
  realizedPnl,
  realizedKrw,
}: {
  label: string;
  realizedPnl: number;
  realizedKrw: number | null;
}) {
  return (
    <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-center">
      <p className="text-sm font-medium text-emerald-300">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-50">
        {formatSignedUsdt(realizedPnl)}
      </p>
      {realizedKrw != null && (
        <p className="text-sm text-zinc-400">({formatSignedKrw(realizedKrw)})</p>
      )}
    </div>
  );
}
