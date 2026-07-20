import { redirect } from "next/navigation";

import { TradePanel } from "@/components/trade-panel";
import { getOpenPositionCount } from "@/lib/positions";
import { createClient } from "@/lib/supabase/server";

export default async function TradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_trading_usdt, initial_usdt")
    .eq("user_id", user.id)
    .single();

  if (!account) redirect("/dashboard");
  if (account.initial_usdt === 0) redirect("/dashboard/margin-setup");

  const openPositionCount = await getOpenPositionCount(supabase, user.id);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <TradePanel
        initialTradingBalance={account.okx_trading_usdt}
        initialOpenPositionCount={openPositionCount}
      />
    </div>
  );
}
