import Link from "next/link";
import { redirect } from "next/navigation";

import { formatKrw, formatUsdt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function BalanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "upbit_krw, upbit_usdt, okx_funding_usdt, okx_trading_usdt, initial_usdt",
    )
    .eq("user_id", user.id)
    .single();

  const nickname = profile?.nickname ?? "사용자";
  const setupComplete = (account?.initial_usdt ?? 0) !== 0;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-lg text-zinc-300">환영합니다,</p>
        <h1 className="mt-1 text-center text-3xl font-semibold tracking-tight text-zinc-50">
          {nickname}님
        </h1>

        {!setupComplete && (
          <Link
            href="/dashboard/margin-setup"
            className="mt-8 block rounded-2xl border-2 border-dashed border-zinc-600 bg-zinc-900/60 p-6 text-center transition hover:border-zinc-400"
          >
            <p className="text-lg font-semibold text-zinc-50">
              증거금 설정을 시작해주세요
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              실전 거래를 위해 초기 자금을 준비해야 해요
            </p>
            <span className="mt-4 inline-block rounded-lg bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-900">
              증거금 설정 시작
            </span>
          </Link>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <BalanceCard label="업비트 KRW" value={formatKrw(account?.upbit_krw ?? 0)} />
          <BalanceCard
            label="업비트 USDT"
            value={formatUsdt(account?.upbit_usdt ?? 0)}
          />
          <BalanceCard
            label="OKX Funding"
            value={formatUsdt(account?.okx_funding_usdt ?? 0)}
          />
          <BalanceCard
            label="OKX Trading"
            value={formatUsdt(account?.okx_trading_usdt ?? 0)}
          />
        </div>

        {setupComplete && (
          <div className="mt-8 space-y-3">
            <Link
              href="/dashboard/trade"
              className="block w-full rounded-lg bg-zinc-100 py-3 text-center text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              선물 거래
            </Link>
            <Link
              href="/dashboard/wallet"
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 py-3 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-700"
            >
              지갑 관리
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
