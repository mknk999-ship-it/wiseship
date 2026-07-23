"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { grantInitialMargin, type MarginState } from "@/app/actions/margin";
import { errorBoxClassName, primaryButtonClassName } from "@/components/ui";
import { formatKrw } from "@/lib/format";
import { INITIAL_MARGIN_KRW } from "@/lib/margin";

const initialState: MarginState = {};
const REDIRECT_DELAY_MS = 1800;

export function InitialMarginGrant() {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    grantInitialMargin,
    initialState,
  );

  useEffect(() => {
    if (!state.success) return;
    const timer = setTimeout(() => router.push("/dashboard"), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.success, router]);

  if (state.success) {
    return (
      <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-6 text-center">
        <p className="text-base font-semibold text-emerald-300">
          {formatKrw(INITIAL_MARGIN_KRW)}이 업비트 원화로 입금되었습니다
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          USDT 구매와 OKX 송금은{" "}
          <Link href="/dashboard/wallet" className="underline hover:text-zinc-200">
            지갑 관리
          </Link>
          에서 진행할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 text-center">
      <p className="text-sm text-zinc-400">
        버튼을 누르면 업비트 원화 잔고로 증거금이 지급돼요
      </p>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : `증거금 ${formatKrw(INITIAL_MARGIN_KRW)} 받기`}
      </button>
    </form>
  );
}
