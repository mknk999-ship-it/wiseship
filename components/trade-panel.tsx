"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { openPositionAction, type TradeState } from "@/app/actions/trade";
import { errorBoxClassName, inputClassName } from "@/components/ui";
import { MAX_LEVERAGE, openPosition, unrealizedPnl, type Side } from "@/lib/engine";
import { formatSignedUsdt, formatUsdt } from "@/lib/format";
import { subscribeMarkPrice, type Symbol } from "@/lib/prices";
import { validateTpSl } from "@/lib/trade";

const initialState: TradeState = {};

const SYMBOLS: Symbol[] = ["BTC-USDT-SWAP", "ETH-USDT-SWAP"];

type Flash = "up" | "down" | null;

export function TradePanel({
  initialTradingBalance,
  initialOpenPositionCount,
}: {
  initialTradingBalance: number;
  initialOpenPositionCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    openPositionAction,
    initialState,
  );

  const [symbol, setSymbol] = useState<Symbol>("BTC-USDT-SWAP");
  const [prices, setPrices] = useState<Record<string, number | null>>({
    "BTC-USDT-SWAP": null,
    "ETH-USDT-SWAP": null,
  });
  const [flash, setFlash] = useState<Record<string, Flash>>({});
  const prevPrices = useRef<Record<string, number | null>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const [side, setSide] = useState<Side>("long");
  const [marginDisplay, setMarginDisplay] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [tpDisplay, setTpDisplay] = useState("");
  const [slDisplay, setSlDisplay] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeMarkPrice(SYMBOLS, (sym, price) => {
      const prev = prevPrices.current[sym];
      prevPrices.current[sym] = price;

      setPrices((p) => ({ ...p, [sym]: price }));

      if (prev != null && price !== prev) {
        const direction: Flash = price > prev ? "up" : "down";
        setFlash((f) => ({ ...f, [sym]: direction }));

        if (flashTimers.current[sym]) clearTimeout(flashTimers.current[sym]);
        flashTimers.current[sym] = setTimeout(() => {
          setFlash((f) => ({ ...f, [sym]: null }));
        }, 400);
      }
    });

    const timers = flashTimers.current;
    return () => {
      unsubscribe();
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const margin = Number(marginDisplay.replace(/,/g, ""));
  const markPrice = prices[symbol];

  const preview =
    markPrice != null && margin > 0
      ? openPosition({
          symbol,
          side,
          margin,
          leverage,
          markPrice,
          tradingBalance: initialTradingBalance,
          openPositionCount: initialOpenPositionCount,
        })
      : null;

  function handleMarginChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9.]/g, "");
    setMarginDisplay(digits);
  }

  const tpPrice = tpDisplay === "" ? null : Number(tpDisplay);
  const slPrice = slDisplay === "" ? null : Number(slDisplay);

  const entryPrice = preview?.ok ? (preview.entryPrice ?? markPrice) : markPrice;
  const qty = preview?.ok ? (preview.qty ?? 0) : 0;
  const liqPrice = preview?.ok ? (preview.liqPrice ?? 0) : 0;

  const tpSlCheck =
    preview?.ok && entryPrice != null
      ? validateTpSl(side, entryPrice, liqPrice, tpPrice, slPrice)
      : {};

  const tpPnl =
    preview?.ok && tpPrice != null && entryPrice != null
      ? unrealizedPnl(side, entryPrice, tpPrice, qty)
      : null;
  const slPnl =
    preview?.ok && slPrice != null && entryPrice != null
      ? unrealizedPnl(side, entryPrice, slPrice, qty)
      : null;

  const symbolFlash = flash[symbol];
  const priceColorClass =
    symbolFlash === "up"
      ? "text-emerald-400"
      : symbolFlash === "down"
        ? "text-red-400"
        : "text-zinc-50";

  const canSubmit =
    !pending &&
    markPrice != null &&
    preview?.ok === true &&
    !tpSlCheck.tpError &&
    !tpSlCheck.slError;

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex rounded-lg bg-zinc-800/60 p-1">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition sm:text-sm ${
              symbol === s
                ? "bg-zinc-700 text-zinc-50 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-400">마크가격</p>
        <p
          className={`mt-1 text-3xl font-semibold tabular-nums transition-colors ${priceColorClass}`}
        >
          {markPrice != null
            ? markPrice.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
            : "불러오는 중..."}
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="symbol" value={symbol} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="margin" value={margin || ""} />
        <input type="hidden" name="leverage" value={leverage} />
        <input type="hidden" name="tpPrice" value={tpPrice ?? ""} />
        <input type="hidden" name="slPrice" value={slPrice ?? ""} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSide("long")}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold transition ${
              side === "long"
                ? "bg-emerald-500 text-zinc-950"
                : "border border-emerald-800 text-emerald-400 hover:bg-emerald-950/40"
            }`}
          >
            롱
          </button>
          <button
            type="button"
            onClick={() => setSide("short")}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold transition ${
              side === "short"
                ? "bg-red-500 text-zinc-950"
                : "border border-red-800 text-red-400 hover:bg-red-950/40"
            }`}
          >
            숏
          </button>
        </div>

        <div>
          <label
            htmlFor="margin-input"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            증거금 (USDT)
          </label>
          <input
            id="margin-input"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={marginDisplay}
            onChange={handleMarginChange}
            className={inputClassName}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="leverage-input"
              className="text-sm font-medium text-zinc-300"
            >
              레버리지
            </label>
            <span className="text-2xl font-bold tabular-nums text-zinc-50">
              {leverage}x
            </span>
          </div>
          <input
            id="leverage-input"
            type="range"
            min={1}
            max={MAX_LEVERAGE}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-zinc-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="tp-input"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              TP (선택)
            </label>
            <input
              id="tp-input"
              type="text"
              inputMode="decimal"
              placeholder="익절가"
              value={tpDisplay}
              onChange={(e) =>
                setTpDisplay(e.target.value.replace(/[^0-9.]/g, ""))
              }
              className={inputClassName}
            />
            {tpPnl != null && !tpSlCheck.tpError && (
              <p className="mt-1 text-xs text-zinc-500">
                도달 시 {formatSignedUsdt(tpPnl)}
              </p>
            )}
            {tpSlCheck.tpError && (
              <p className="mt-1 text-xs text-red-400">{tpSlCheck.tpError}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="sl-input"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              SL (선택)
            </label>
            <input
              id="sl-input"
              type="text"
              inputMode="decimal"
              placeholder="손절가"
              value={slDisplay}
              onChange={(e) =>
                setSlDisplay(e.target.value.replace(/[^0-9.]/g, ""))
              }
              className={inputClassName}
            />
            {slPnl != null && !tpSlCheck.slError && (
              <p className="mt-1 text-xs text-zinc-500">
                도달 시 {formatSignedUsdt(slPnl)}
              </p>
            )}
            {tpSlCheck.slError && (
              <p className="mt-1 text-xs text-red-400">{tpSlCheck.slError}</p>
            )}
            {!tpSlCheck.slError && tpSlCheck.liqWarning && (
              <p className="mt-1 text-xs text-amber-400">
                ⚠ {tpSlCheck.liqWarning}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
          <p className="mb-2 font-medium text-zinc-300">주문 미리보기</p>
          {preview?.ok ? (
            <>
              <Row label="명목가" value={formatUsdt(preview.notional ?? 0)} />
              <Row
                label="예상 수량"
                value={`${(preview.qty ?? 0).toFixed(6)}`}
              />
              <Row label="진입 수수료" value={formatUsdt(preview.openFee ?? 0)} />
              <Row
                label="예상 청산가"
                value={(preview.liqPrice ?? 0).toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
              />
            </>
          ) : (
            <p className="text-zinc-500">증거금을 입력하면 미리보기가 표시돼요.</p>
          )}
        </div>

        {preview && !preview.ok && (
          <p className={errorBoxClassName}>{preview.error}</p>
        )}
        {state.error && <p className={errorBoxClassName}>{state.error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-lg py-3 text-sm font-semibold text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-60 ${
            side === "long"
              ? "bg-emerald-500 hover:bg-emerald-400"
              : "bg-red-500 hover:bg-red-400"
          }`}
        >
          {pending ? "처리 중..." : side === "long" ? "롱 진입" : "숏 진입"}
        </button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums text-zinc-50">{value}</span>
    </div>
  );
}
