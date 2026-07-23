import Link from "next/link";
import { redirect } from "next/navigation";

import { formatKrw, formatUsdt } from "@/lib/format";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";

function TotalAssetCard({
  title,
  titleExtra,
  children,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      {titleExtra != null && (
        <p className="mt-1 break-words text-2xl font-bold tabular-nums text-white">
          {titleExtra}
        </p>
      )}
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function KrwRow({ label, krw }: { label: string; krw: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 whitespace-nowrap text-zinc-400">{label}</span>
      <span className="min-w-0 font-medium tabular-nums text-zinc-300">
        {formatKrw(krw)}
      </span>
    </div>
  );
}

function UsdtRow({
  label,
  usdt,
  rate,
}: {
  label: string;
  usdt: number;
  rate: number | null;
}) {
  const krw = rate != null ? usdt * rate : null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 whitespace-nowrap text-zinc-400">{label}</span>
      <span className="min-w-0 text-right">
        <span className="font-medium tabular-nums text-zinc-300">
          {formatUsdt(usdt)}
        </span>
        {krw != null && (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            ({formatKrw(krw)})
          </span>
        )}
      </span>
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
      "upbit_krw, upbit_usdt, okx_funding_usdt, okx_trading_usdt, initial_krw",
    )
    .eq("user_id", user.id)
    .single();

  let rate: number | null = null;
  try {
    rate = await getUsdtKrw();
  } catch {
    rate = null;
  }

  const nickname = profile?.nickname ?? "사용자";
  const setupComplete = (account?.initial_krw ?? 0) !== 0;

  const upbitKrw = account?.upbit_krw ?? 0;
  const upbitUsdt = account?.upbit_usdt ?? 0;
  const okxFunding = account?.okx_funding_usdt ?? 0;
  const okxTrading = account?.okx_trading_usdt ?? 0;
  const okxWalletUsdt = okxFunding + okxTrading;

  const upbitTotalKrw = rate != null ? upbitKrw + upbitUsdt * rate : null;
  const okxWalletKrw = rate != null ? okxWalletUsdt * rate : null;

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
              증거금 1,000만원을 받아보세요
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              실전 거래를 위해 초기 자금을 받아야 해요
            </p>
            <span className="mt-4 inline-block rounded-lg bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-900">
              증거금 받기
            </span>
          </Link>
        )}

        <div className="mt-8 space-y-3">
          <TotalAssetCard
            title="업비트 총자산"
            titleExtra={upbitTotalKrw != null ? formatKrw(upbitTotalKrw) : undefined}
          >
            <KrwRow label="KRW" krw={upbitKrw} />
            <UsdtRow label="USDT" usdt={upbitUsdt} rate={rate} />
          </TotalAssetCard>
          <TotalAssetCard
            title="OKX 총자산"
            titleExtra={
              <>
                {formatUsdt(okxWalletUsdt)}
                {okxWalletKrw != null && (
                  <span className="ml-1 text-base font-normal text-zinc-400">
                    ({formatKrw(okxWalletKrw)})
                  </span>
                )}
              </>
            }
          >
            <UsdtRow label="Funding" usdt={okxFunding} rate={rate} />
            <UsdtRow label="Trading" usdt={okxTrading} rate={rate} />
          </TotalAssetCard>
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
