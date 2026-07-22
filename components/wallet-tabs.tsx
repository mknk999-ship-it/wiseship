"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BalanceCard } from "@/components/balance-card";
import { OkxFlow } from "@/components/okx-flow";
import { UpbitFlow } from "@/components/upbit-flow";
import { formatKrw, formatUsdtAmount } from "@/lib/format";

type Tab = "upbit" | "okx";

const DONE_MESSAGES: Record<string, string> = {
  buy_usdt: "USDT 구매가 완료됐어요.",
  deposit_to_okx_funding: "OKX Funding으로 송금됐어요.",
  funding_to_trading: "Trading으로 이체됐어요.",
  trading_to_funding: "Funding으로 이체됐어요.",
  withdraw_to_upbit: "업비트로 출금됐어요.",
  sell_usdt_to_krw: "원화 매도가 완료됐어요.",
};

const SCROLL_STORAGE_KEY = "wallet-scroll-y";

function parseTab(value: string | null): Tab {
  if (value === "okx") return value;
  return "upbit";
}

export function WalletTabs({
  funding,
  trading,
  upbitUsdt,
  upbitKrw,
  rate,
}: {
  funding: number;
  trading: number;
  upbitUsdt: number;
  upbitKrw: number;
  rate: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const done = searchParams.get("done");

  const [toast, setToast] = useState<string | null>(null);
  const handledDoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!done || handledDoneRef.current === done) return;
    handledDoneRef.current = done;

    setToast(DONE_MESSAGES[done] ?? null);

    const saved = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (saved != null) {
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
      window.scrollTo(0, Number(saved));
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("done");
    const query = params.toString();
    router.replace(`/dashboard/wallet${query ? `?${query}` : ""}`, {
      scroll: false,
    });

    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function handleFormSubmit() {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
  }

  function switchTab(next: Tab) {
    router.replace(`/dashboard/wallet?tab=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-6" onSubmit={handleFormSubmit}>
      {toast && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-center text-sm text-emerald-300">
          {toast}
        </div>
      )}

      <div className="flex rounded-lg bg-zinc-800/60 p-1">
        <button
          type="button"
          onClick={() => switchTab("upbit")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "upbit"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          업비트
        </button>
        <button
          type="button"
          onClick={() => switchTab("okx")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "okx"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          OKX
        </button>
      </div>

      {tab === "upbit" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <BalanceCard label="업비트 KRW" value={formatKrw(upbitKrw)} />
            <BalanceCard label="업비트 USDT" value={`${formatUsdtAmount(upbitUsdt)} USDT`} />
          </div>
          <UpbitFlow upbitKrw={upbitKrw} upbitUsdt={upbitUsdt} rate={rate} />
        </>
      )}
      {tab === "okx" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <BalanceCard label="OKX Funding" value={`${formatUsdtAmount(funding)} USDT`} />
            <BalanceCard label="OKX Trading" value={`${formatUsdtAmount(trading)} USDT`} />
          </div>
          <OkxFlow funding={funding} trading={trading} />
        </>
      )}
    </div>
  );
}
