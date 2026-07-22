import type { SupabaseClient } from "@supabase/supabase-js";

import { formatKrw, formatUsdt } from "@/lib/format";

const WALLET_TRANSACTION_TYPES = [
  "upbit_deposit",
  "usdt_buy",
  "okx_transfer",
  "wallet_transfer",
  "okx_withdraw",
  "usdt_sell",
] as const;

export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export type WalletTransaction = {
  type: WalletTransactionType;
  detail: Record<string, string | number | undefined>;
  created_at: string;
};

/** 포지션 진입/청산과 섞이지 않도록 입출금 계열 transactions만 골라 온다. */
export async function getWalletTransactions(
  supabase: SupabaseClient,
  userId: string,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ items: WalletTransaction[]; total: number }> {
  const { data, count } = await supabase
    .from("transactions")
    .select("type, detail, created_at", { count: "exact" })
    .eq("user_id", userId)
    .in("type", WALLET_TRANSACTION_TYPES)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { items: (data ?? []) as WalletTransaction[], total: count ?? 0 };
}

const TYPE_LABEL: Record<WalletTransactionType, string> = {
  upbit_deposit: "업비트 입금",
  usdt_buy: "USDT 매수",
  okx_transfer: "OKX 송금",
  wallet_transfer: "지갑 이체",
  okx_withdraw: "업비트로 출금",
  usdt_sell: "원화 매도",
};

export function walletTransactionLabel(type: WalletTransactionType): string {
  return TYPE_LABEL[type] ?? type;
}

export function walletTransactionSummary(tx: WalletTransaction): string {
  const d = tx.detail;
  switch (tx.type) {
    case "upbit_deposit":
      return formatKrw(Number(d.amount_krw));
    case "usdt_buy":
      return `${formatKrw(Number(d.krw_amount))} → ${formatUsdt(Number(d.usdt_amount))}`;
    case "okx_transfer":
      return formatUsdt(Number(d.usdt_amount));
    case "wallet_transfer": {
      const dir =
        d.direction === "funding_to_trading"
          ? "Funding → Trading"
          : "Trading → Funding";
      return `${dir} · ${formatUsdt(Number(d.amount))}`;
    }
    case "okx_withdraw":
      return formatUsdt(Number(d.usdt_amount));
    case "usdt_sell":
      return `${formatUsdt(Number(d.usdt_amount))} → ${formatKrw(Number(d.krw_amount))}`;
    default:
      return "";
  }
}
