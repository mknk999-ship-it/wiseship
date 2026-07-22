"use client";

import { useActionState, useState } from "react";

import { buyUsdt, type MarginState } from "@/app/actions/margin";
import {
  errorBoxClassName,
  inputClassName,
  maxButtonClassName,
  primaryButtonClassName,
} from "@/components/ui";
import { sanitizeIntegerInput } from "@/lib/decimal-input";
import { formatKrw, formatUsdt } from "@/lib/format";

const initialState: MarginState = {};

export function BuyUsdtPartialForm({
  upbitKrw,
  rate,
}: {
  upbitKrw: number;
  rate: number;
}) {
  const [state, action, pending] = useActionState(buyUsdt, initialState);
  const [display, setDisplay] = useState("");
  const [useMax, setUseMax] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(sanitizeIntegerInput(e.target.value));
    setUseMax(false);
  }

  function handleMax() {
    setDisplay(String(Math.floor(upbitKrw)));
    setUseMax(true);
  }

  const amount = Number(display);
  const estimatedUsdt = amount > 0 ? amount / rate : null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="useMax" value={useMax ? "1" : ""} />
      <p className="text-xs text-zinc-400">
        현재 USDT/KRW 시세{" "}
        <span className="font-medium text-zinc-200">{formatKrw(rate)}</span>
      </p>

      <div>
        <label
          htmlFor="buy-usdt-amount"
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          구매할 금액 (KRW)
        </label>
        <div className="relative">
          <input
            id="buy-usdt-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder={`최대 ${formatKrw(upbitKrw)}`}
            value={display}
            onChange={handleChange}
            className={`${inputClassName} pr-16`}
            required
          />
          <button
            type="button"
            onClick={handleMax}
            className={maxButtonClassName}
          >
            MAX
          </button>
        </div>
        {estimatedUsdt != null && (
          <p className="mt-1 text-xs text-zinc-500">
            약 {formatUsdt(estimatedUsdt)} 예상 · 실제 체결 시 서버가 재조회한
            시세가 적용돼요
          </p>
        )}
      </div>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : "구매"}
      </button>
    </form>
  );
}
