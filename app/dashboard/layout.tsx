import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardRefresher } from "@/components/dashboard-refresher";
import { getOpenPositionCount } from "@/lib/positions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_trading_usdt, okx_funding_usdt")
    .eq("user_id", user.id)
    .single();

  const openPositionCount = await getOpenPositionCount(supabase, user.id);

  return (
    <>
      <DashboardHeader
        nickname={profile?.nickname ?? "사용자"}
        tradingBalance={account?.okx_trading_usdt ?? 0}
        fundingBalance={account?.okx_funding_usdt ?? 0}
        openPositionCount={openPositionCount}
      />
      <DashboardRefresher />
      {children}
    </>
  );
}
