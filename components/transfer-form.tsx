"use client";

import { useActionState } from "react";

import { transferToOkxFunding, type MarginState } from "@/app/actions/margin";
import { errorBoxClassName, primaryButtonClassName } from "@/components/ui";
import { formatUsdt } from "@/lib/format";

const initialState: MarginState = {};

export function TransferForm({ balance }: { balance: number }) {
  const [state, action, pending] = useActionState(
    transferToOkxFunding,
    initialState,
  );

  return (
    <form action={action} className="space-y-4 text-center">
      <p className="text-sm text-zinc-400">OKX Funding 지갑으로 송금할 금액</p>
      <p className="text-2xl font-semibold text-zinc-50">
        {formatUsdt(balance)}
      </p>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : "송금"}
      </button>
    </form>
  );
}
