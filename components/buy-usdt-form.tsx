"use client";

import { useActionState } from "react";

import { buyUsdtAll, type MarginState } from "@/app/actions/margin";
import { errorBoxClassName, primaryButtonClassName } from "@/components/ui";
import { formatKrw } from "@/lib/format";

const initialState: MarginState = {};

export function BuyUsdtForm({ rate }: { rate: number }) {
  const [state, action, pending] = useActionState(buyUsdtAll, initialState);

  return (
    <form action={action} className="space-y-4 text-center">
      <p className="text-sm text-zinc-400">현재 USDT/KRW 시세</p>
      <p className="text-2xl font-semibold text-zinc-50">{formatKrw(rate)}</p>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : "전액 매수"}
      </button>
    </form>
  );
}
