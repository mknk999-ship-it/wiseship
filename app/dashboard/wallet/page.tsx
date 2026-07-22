import { redirect } from "next/navigation";

import { WalletTabs } from "@/components/wallet-tabs";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_funding_usdt, okx_trading_usdt, upbit_usdt, upbit_krw, initial_usdt")
    .eq("user_id", user.id)
    .single();

  if (!account) redirect("/dashboard");
  if (account.initial_usdt === 0) redirect("/dashboard/margin-setup");

  let rate: number | null = null;
  try {
    rate = await getUsdtKrw();
  } catch {
    rate = null;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          지갑 관리
        </h1>
        <WalletTabs
          funding={account.okx_funding_usdt}
          trading={account.okx_trading_usdt}
          upbitUsdt={account.upbit_usdt}
          upbitKrw={account.upbit_krw}
          rate={rate}
        />
      </div>
    </div>
  );
}
