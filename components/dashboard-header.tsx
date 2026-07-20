import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { formatUsdt, formatUsdtCompact } from "@/lib/format";

export function DashboardHeader({
  nickname,
  tradingBalance,
  fundingBalance,
  openPositionCount,
}: {
  nickname: string;
  tradingBalance: number;
  fundingBalance: number;
  openPositionCount: number;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/dashboard"
          className="shrink-0 text-lg font-semibold tracking-tight text-zinc-50"
        >
          Wiseship
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              Trading
            </p>
            <p className="text-sm font-semibold tabular-nums text-zinc-50">
              {formatUsdt(tradingBalance)}
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              Funding
            </p>
            <p className="text-sm font-semibold tabular-nums text-zinc-300">
              {formatUsdtCompact(fundingBalance)}
            </p>
          </div>

          <Link
            href="/dashboard/positions"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600"
          >
            포지션 {openPositionCount}/5
          </Link>

          <Link
            href="/dashboard/ranking"
            className="hidden rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 sm:inline-block"
          >
            랭킹
          </Link>

          <span className="hidden text-sm text-zinc-400 sm:inline">
            {nickname}님
          </span>

          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-red-800 hover:text-red-300"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
