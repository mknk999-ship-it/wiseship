"use client";

import { useActionState, useState } from "react";

import { walletTransfer, type MarginState } from "@/app/actions/margin";
import {
  errorBoxClassName,
  inputClassName,
  maxButtonClassName,
  primaryButtonClassName,
} from "@/components/ui";
import { floorTo2, sanitizeDecimalInput } from "@/lib/decimal-input";
import { formatUsdt } from "@/lib/format";

const initialState: MarginState = {};

export function SingleWalletTransferForm({
  direction,
  balance,
  submitLabel,
}: {
  direction: "funding_to_trading" | "trading_to_funding";
  balance: number;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(
    walletTransfer,
    initialState,
  );
  const [display, setDisplay] = useState("");
  const [useMax, setUseMax] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(sanitizeDecimalInput(e.target.value));
    setUseMax(false);
  }

  function handleMax() {
    setDisplay(String(floorTo2(balance)));
    setUseMax(true);
  }

  const inputId = `wallet-transfer-amount-${direction}`;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="useMax" value={useMax ? "1" : ""} />
      <div>
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          이체 금액 (USDT)
        </label>
        <div className="relative">
          <input
            id={inputId}
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder={`최대 ${formatUsdt(balance)}`}
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
        {pending ? "처리 중..." : submitLabel}
      </button>
    </form>
  );
}
