"use client";

import { useActionState, useState } from "react";

import { walletTransfer, type MarginState } from "@/app/actions/margin";
import {
  errorBoxClassName,
  inputClassName,
  primaryButtonClassName,
} from "@/components/ui";
import { formatUsdt } from "@/lib/format";

const initialState: MarginState = {};

type Direction = "funding_to_trading" | "trading_to_funding";

export function WalletTransferForm({
  funding,
  trading,
}: {
  funding: number;
  trading: number;
}) {
  const [state, action, pending] = useActionState(
    walletTransfer,
    initialState,
  );
  const [direction, setDirection] = useState<Direction>("funding_to_trading");
  const [display, setDisplay] = useState("");

  const sourceBalance = direction === "funding_to_trading" ? funding : trading;

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(e.target.value.replace(/[^0-9.]/g, ""));
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400">Funding 지갑</p>
          <p className="mt-1 text-lg font-semibold text-zinc-50">
            {formatUsdt(funding)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400">Trading 지갑</p>
          <p className="mt-1 text-lg font-semibold text-zinc-50">
            {formatUsdt(trading)}
          </p>
        </div>
      </div>

      <div className="flex rounded-lg bg-zinc-800/60 p-1">
        <button
          type="button"
          onClick={() => setDirection("funding_to_trading")}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition sm:text-sm ${
            direction === "funding_to_trading"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Funding → Trading
        </button>
        <button
          type="button"
          onClick={() => setDirection("trading_to_funding")}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition sm:text-sm ${
            direction === "trading_to_funding"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Trading → Funding
        </button>
      </div>
      <input type="hidden" name="direction" value={direction} />

      <div>
        <label
          htmlFor="wallet-amount"
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          이체 금액 (USDT)
        </label>
        <input
          id="wallet-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder={`최대 ${formatUsdt(sourceBalance)}`}
          value={display}
          onChange={handleAmountChange}
          className={inputClassName}
          required
        />
      </div>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : "이체"}
      </button>
    </form>
  );
}
