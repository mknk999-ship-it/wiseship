"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  closePositionAction,
  setPositionTpSl,
  type CloseState,
  type TpSlState,
} from "@/app/actions/trade";
import { PriceChart } from "@/components/price-chart";
import { errorBoxClassName, inputClassName } from "@/components/ui";
import { roePercent, toKrw, unrealizedPnl, type Side } from "@/lib/engine";
import {
  formatKrw,
  formatRelativeTime,
  formatSignedKrw,
  formatSignedUsdt,
  formatSymbol,
  formatUsdt,
  pnlColorClass,
} from "@/lib/format";
import type { OpenPosition } from "@/lib/positions";
import { validateTpSl } from "@/lib/trade";

const LIQ_WARNING_THRESHOLD = 5;
const initialState: CloseState = {};
const initialTpSlState: TpSlState = {};

export function PositionCard({
  position,
  markPrice,
  usdtKrwRate,
}: {
  position: OpenPosition;
  markPrice: number | null;
  usdtKrwRate: number | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    closePositionAction,
    initialState,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tpSlModalOpen, setTpSlModalOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => router.refresh(), 2500);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  const pnl =
    markPrice != null
      ? unrealizedPnl(position.side, position.entry_price, markPrice, position.qty)
      : null;
  const roe = pnl != null ? roePercent(pnl, position.margin) : null;
  const pnlKrw =
    pnl != null && usdtKrwRate != null ? pnl * usdtKrwRate : null;
  const marginKrw =
    usdtKrwRate != null ? toKrw(position.margin, usdtKrwRate) : null;

  const liqDistance =
    markPrice != null
      ? (Math.abs(markPrice - position.liq_price) / markPrice) * 100
      : null;
  const nearLiquidation =
    liqDistance != null && liqDistance <= LIQ_WARNING_THRESHOLD;

  const pnlColorClassValue = pnl == null ? "text-zinc-50" : pnlColorClass(pnl);

  if (state.success) {
    return (
      <li>
        <SettledNotice
          label="청산 완료"
          realizedPnl={state.realizedPnl ?? 0}
          realizedKrw={state.realizedKrw ?? null}
        />
      </li>
    );
  }

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
        <span>진입 시간</span>
        <span className="text-right text-zinc-200">
          {formatRelativeTime(position.opened_at)}
        </span>
        <span>진입가</span>
        <span className="text-right text-zinc-200">
          {position.entry_price.toLocaleString("ko-KR", {
            maximumFractionDigits: 2,
          })}
        </span>
        <span>수량</span>
        <span className="text-right text-zinc-200">
          {position.qty.toFixed(6)}
        </span>
        <span>증거금</span>
        <span className="text-right leading-tight text-zinc-200">
          <span className="block">{formatUsdt(position.margin)}</span>
          {marginKrw != null && (
            <span className="block text-[11px] text-zinc-500">
              {formatKrw(marginKrw)}
            </span>
          )}
        </span>
        <span>현재가</span>
        <span className="text-right text-zinc-200">
          {markPrice != null
            ? markPrice.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
            : "불러오는 중..."}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-950/40 p-3">
        <div>
          <p className="text-xs text-zinc-400">미실현 손익</p>
          <p className={`text-base font-semibold ${pnlColorClassValue}`}>
            {pnl != null ? formatSignedUsdt(pnl) : "계산 중..."}
            {pnlKrw != null && (
              <span className="ml-1 text-xs font-normal text-zinc-500">
                ({formatSignedKrw(pnlKrw)})
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">ROE</p>
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
        <span>
          TP{" "}
          <span className="text-zinc-300">
            {position.tp_price != null
              ? position.tp_price.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
        </span>
        <span>
          SL{" "}
          <span className="text-zinc-300">
            {position.sl_price != null
              ? position.sl_price.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
        </span>
      </div>

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

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-red-800 hover:text-red-300"
        >
          시장가 청산
        </button>
      ) : (
        <div className="mt-4 space-y-2 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
          <p className="text-center text-sm text-zinc-300">
            정말 시장가로 청산할까요?
          </p>
          <form action={formAction} className="flex gap-2">
            <input type="hidden" name="positionId" value={position.id} />
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
              {pending ? "처리 중..." : "청산 확정"}
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
