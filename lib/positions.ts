import type { SupabaseClient } from "@supabase/supabase-js";

import type { Side } from "@/lib/engine";
import type { Symbol } from "@/lib/prices";

export type OpenPosition = {
  id: string;
  symbol: Symbol;
  side: Side;
  margin: number;
  leverage: number;
  qty: number;
  entry_price: number;
  liq_price: number;
  tp_price: number | null;
  sl_price: number | null;
};

export async function getOpenPositionCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("positions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "open");
  return count ?? 0;
}
