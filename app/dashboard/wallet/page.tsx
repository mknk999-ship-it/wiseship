import { redirect } from "next/navigation";

import { WalletTransferForm } from "@/components/wallet-transfer-form";
import { createClient } from "@/lib/supabase/server";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_funding_usdt, okx_trading_usdt, initial_usdt")
    .eq("user_id", user.id)
    .single();

  if (!account) redirect("/dashboard");
  if (account.initial_usdt === 0) redirect("/dashboard/margin-setup");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          지갑 관리
        </h1>
        <WalletTransferForm
          funding={account.okx_funding_usdt}
          trading={account.okx_trading_usdt}
        />
      </div>
    </div>
  );
}
