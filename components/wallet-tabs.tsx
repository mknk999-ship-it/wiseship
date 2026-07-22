"use client";

import { useState } from "react";

import { WalletTransferForm } from "@/components/wallet-transfer-form";
import { WithdrawFlow } from "@/components/withdraw-flow";

type Tab = "transfer" | "withdraw";

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
  const [tab, setTab] = useState<Tab>("transfer");

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg bg-zinc-800/60 p-1">
        <button
          type="button"
          onClick={() => setTab("transfer")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "transfer"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          이체
        </button>
        <button
          type="button"
          onClick={() => setTab("withdraw")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "withdraw"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          출금
        </button>
      </div>

      {tab === "transfer" ? (
        <WalletTransferForm funding={funding} trading={trading} />
      ) : (
        <WithdrawFlow
          funding={funding}
          upbitUsdt={upbitUsdt}
          upbitKrw={upbitKrw}
          rate={rate}
        />
      )}
    </div>
  );
}
