import { redirect } from "next/navigation";

import { RankingTabs } from "@/components/ranking-tabs";
import { getRankings } from "@/lib/ranking";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";

export default async function RankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rankings = await getRankings(user.id);

  let usdtKrwRate: number | null = null;
  try {
    usdtKrwRate = await getUsdtKrw();
  } catch {
    usdtKrwRate = null;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          랭킹
        </h1>
        <RankingTabs
          profit={rankings.profit}
          returnRate={rankings.returnRate}
          usdtKrwRate={usdtKrwRate}
        />
      </div>
    </div>
  );
}
