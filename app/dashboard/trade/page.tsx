import { redirect } from "next/navigation";

import { TradePanel } from "@/components/trade-panel";
import { getOpenPositions } from "@/lib/positions";
import { createClient } from "@/lib/supabase/server";

export default async function TradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_trading_usdt, initial_krw")
    .eq("user_id", user.id)
    .single();

  if (!account) redirect("/dashboard");
  if (account.initial_krw === 0) redirect("/dashboard/margin-setup");

  const openPositions = await getOpenPositions(supabase, user.id);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
      <TradePanel
        initialTradingBalance={account.okx_trading_usdt}
        openPositions={openPositions}
      />
    </div>
  );
}
