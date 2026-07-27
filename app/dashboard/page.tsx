import Link from "next/link";
import { redirect } from "next/navigation";

import { ClosedPositionCard } from "@/components/closed-position-card";
import { CollapsibleSection } from "@/components/collapsible-section";
import { PaginationLinks } from "@/components/pagination-links";
import { PositionsList } from "@/components/positions-list";
import { MAX_OPEN_POSITIONS, roePercent } from "@/lib/engine";
import { calcTotalEquity } from "@/lib/equity";
import {
  formatDateTime,
  formatKrw,
  formatSignedKrw,
  formatSignedUsdt,
  formatUsdt,
  pnlColorClass,
} from "@/lib/format";
import {
  getCloseReasons,
  getClosedPositions,
  getOpenPositions,
  getPositionAggregate,
  type CloseReason,
} from "@/lib/positions";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";
import {
  getWalletTransactions,
  walletTransactionLabel,
  walletTransactionSummary,
} from "@/lib/transactions";

const PAGE_SIZE = 10;

// 이 콘텐츠는 라우트 /dashboard에서 렌더된다. 탭/페이지네이션이 자기 자신을
// 가리키는 링크를 만들 때 이 경로를 기준으로 삼는다.
const BASE_PATH = "/dashboard";

type MainTab = "positions" | "history";
type SubTab = "trades" | "wallet";

function tabHref(tab: MainTab, sub: SubTab = "trades") {
  const params = new URLSearchParams({ tab });
  if (tab === "history") params.set("sub", sub);
  return `${BASE_PATH}?${params.toString()}`;
}

function pageHref(tab: MainTab, sub: SubTab, page: number) {
  const params = new URLSearchParams({ tab, page: String(page) });
  if (tab === "history") params.set("sub", sub);
  return `${BASE_PATH}?${params.toString()}`;
}

function pillClass(active: boolean) {
  return `flex-1 rounded-md py-2 text-center text-sm font-medium transition ${
    active
      ? "bg-zinc-700 text-zinc-50 shadow-sm"
      : "text-zinc-400 hover:text-zinc-200"
  }`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sub?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tab: MainTab = sp.tab === "history" ? "history" : "positions";
  const sub: SubTab = sp.sub === "wallet" ? "wallet" : "trades";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("upbit_krw, upbit_usdt, okx_funding_usdt, okx_trading_usdt")
    .eq("user_id", user.id)
    .single();

  let rate: number | null = null;
  try {
    rate = await getUsdtKrw();
  } catch {
    rate = null;
  }

  const upbitKrw = account?.upbit_krw ?? 0;
  const upbitUsdt = account?.upbit_usdt ?? 0;
  const okxFunding = account?.okx_funding_usdt ?? 0;
  const okxTrading = account?.okx_trading_usdt ?? 0;
  const okxWalletUsdt = okxFunding + okxTrading;

  const upbitTotalKrw = rate != null ? upbitKrw + upbitUsdt * rate : null;

  const aggregate = await getPositionAggregate(supabase, user.id);
  const okxTotalEquity = calcTotalEquity({
    walletBalance: okxWalletUsdt,
    totalMargin: aggregate.totalMargin,
    totalUnrealizedPnl: aggregate.totalUnrealizedPnl,
  });
  const okxTotalEquityKrw = rate != null ? okxTotalEquity * rate : null;
  const pnlKrw = rate != null ? aggregate.totalUnrealizedPnl * rate : null;
  const pnlRoe =
    aggregate.totalMargin > 0
      ? roePercent(aggregate.totalUnrealizedPnl, aggregate.totalMargin)
      : null;
  const pnlColor = pnlColorClass(aggregate.totalUnrealizedPnl);

  let openPositions: Awaited<ReturnType<typeof getOpenPositions>> = [];
  let closedItems: Awaited<ReturnType<typeof getClosedPositions>>["items"] = [];
  let closedTotal = 0;
  let closeReasons = new Map<string, CloseReason>();
  let walletItems: Awaited<ReturnType<typeof getWalletTransactions>>["items"] =
    [];
  let walletTotal = 0;

  if (tab === "positions") {
    openPositions = await getOpenPositions(supabase, user.id);
  } else if (sub === "trades") {
    const result = await getClosedPositions(supabase, user.id, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    closedItems = result.items;
    closedTotal = result.total;
    closeReasons = await getCloseReasons(
      supabase,
      user.id,
      closedItems.filter((p) => p.status === "closed").map((p) => p.id),
    );
  } else {
    const result = await getWalletTransactions(supabase, user.id, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    walletItems = result.items;
    walletTotal = result.total;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-50">
          총자산
        </h1>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            업비트
          </p>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-xs text-zinc-400">원화 총자산</p>
            {upbitTotalKrw != null ? (
              <p className="mt-1 text-2xl font-semibold text-zinc-50">
                {formatKrw(upbitTotalKrw)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-300">
                시세를 불러오지 못해 USDT 환산을 뺀 값이에요
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              KRW {formatKrw(upbitKrw)} + USDT {formatUsdt(upbitUsdt)} 환산 합계
            </p>
          </div>
        </section>

        <CollapsibleSection title="OKX 계좌내역">
          <div>
            <p className="text-xs text-zinc-400">원화 총자산</p>
            {okxTotalEquityKrw != null ? (
              <p className="mt-1 text-2xl font-semibold text-zinc-50">
                {formatKrw(okxTotalEquityKrw)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-300">
                시세를 불러오지 못해 원화 환산을 표시할 수 없어요
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 whitespace-nowrap text-zinc-400">
              OKX 평가자산
            </span>
            <span className="min-w-0 text-right font-medium text-zinc-50">
              {formatUsdt(okxTotalEquity)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950/40 p-3">
            <span className="shrink-0 whitespace-nowrap text-sm text-zinc-400">
              미실현 손익
            </span>
            <span className={`min-w-0 text-right text-sm font-semibold ${pnlColor}`}>
              {formatSignedUsdt(aggregate.totalUnrealizedPnl)}
              {pnlKrw != null && (
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  ({formatSignedKrw(pnlKrw)})
                </span>
              )}
              {pnlRoe != null && (
                <span className="ml-2">
                  {pnlRoe > 0 ? "+" : ""}
                  {pnlRoe.toFixed(2)}%
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 whitespace-nowrap text-zinc-400">
              보유 USDT (Funding+Trading)
            </span>
            <span className="min-w-0 text-right font-medium text-zinc-50">
              {formatUsdt(okxWalletUsdt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 whitespace-nowrap text-zinc-400">총 증거금</span>
            <span className="min-w-0 text-right font-medium text-zinc-50">
              {formatUsdt(aggregate.totalMargin)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 whitespace-nowrap text-zinc-400">보유 포지션</span>
            <span className="min-w-0 text-right font-medium text-zinc-50">
              {aggregate.openCount}/{MAX_OPEN_POSITIONS}
            </span>
          </div>
        </CollapsibleSection>

        <div>
          <div className="flex rounded-lg bg-zinc-800/60 p-1">
            <Link href={tabHref("positions")} className={pillClass(tab === "positions")}>
              보유 포지션
            </Link>
            <Link href={tabHref("history")} className={pillClass(tab === "history")}>
              거래 내역
            </Link>
          </div>

          {tab === "history" && (
            <div className="mt-2 flex rounded-lg bg-zinc-800/60 p-1">
              <Link
                href={tabHref("history", "trades")}
                className={pillClass(sub === "trades")}
              >
                청산 내역
              </Link>
              <Link
                href={tabHref("history", "wallet")}
                className={pillClass(sub === "wallet")}
              >
                입출금 내역
              </Link>
            </div>
          )}

          <div className="mt-4">
            {tab === "positions" && (
              <PositionsList initialPositions={openPositions} />
            )}

            {tab === "history" && sub === "trades" && (
              <>
                {closedItems.length === 0 ? (
                  <p className="text-center text-sm text-zinc-400">
                    종료된 거래가 없어요.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {closedItems.map((p) => (
                      <ClosedPositionCard
                        key={p.id}
                        position={p}
                        reason={
                          p.status === "liquidated"
                            ? "liquidated"
                            : (closeReasons.get(p.id) ?? "manual")
                        }
                      />
                    ))}
                  </ul>
                )}
                <PaginationLinks
                  page={page}
                  totalPages={Math.max(1, Math.ceil(closedTotal / PAGE_SIZE))}
                  makeHref={(p) => pageHref("history", "trades", p)}
                />
              </>
            )}

            {tab === "history" && sub === "wallet" && (
              <>
                {walletItems.length === 0 ? (
                  <p className="text-center text-sm text-zinc-400">
                    입출금 내역이 없어요.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {walletItems.map((tx, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                      >
                        <div className="shrink-0">
                          <p className="whitespace-nowrap text-sm font-medium text-zinc-100">
                            {walletTransactionLabel(tx.type)}
                          </p>
                          <p className="mt-1 whitespace-nowrap text-xs text-zinc-500">
                            {formatDateTime(tx.created_at)}
                          </p>
                        </div>
                        <p className="min-w-0 text-right text-sm font-medium text-zinc-200">
                          {walletTransactionSummary(tx)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <PaginationLinks
                  page={page}
                  totalPages={Math.max(1, Math.ceil(walletTotal / PAGE_SIZE))}
                  makeHref={(p) => pageHref("history", "wallet", p)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
