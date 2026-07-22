"use client";

import { useActionState, useState } from "react";

import { withdrawToUpbit, type MarginState } from "@/app/actions/margin";
import {
  errorBoxClassName,
  inputClassName,
  maxButtonClassName,
  primaryButtonClassName,
} from "@/components/ui";
import { formatUsdt } from "@/lib/format";

const initialState: MarginState = {};

export function WithdrawToUpbitForm({ funding }: { funding: number }) {
  const [state, action, pending] = useActionState(
    withdrawToUpbit,
    initialState,
  );
  const [display, setDisplay] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(e.target.value.replace(/[^0-9.]/g, ""));
  }

  function handleMax() {
    setDisplay(String(funding));
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label
          htmlFor="funding-withdraw-amount"
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          출금할 금액 (USDT)
        </label>
        <div className="relative">
          <input
            id="funding-withdraw-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder={`최대 ${formatUsdt(funding)}`}
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
      </div>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : "업비트로 출금"}
      </button>
    </form>
  );
}
