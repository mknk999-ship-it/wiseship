import Link from "next/link";

import { NavMenu } from "@/components/nav-menu";
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

          <NavMenu nickname={nickname} openPositionCount={openPositionCount} />
        </div>
      </div>
    </header>
  );
}
