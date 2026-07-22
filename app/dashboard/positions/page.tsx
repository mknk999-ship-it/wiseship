import { redirect } from "next/navigation";

import { PositionsList } from "@/components/positions-list";
import { getOpenPositions } from "@/lib/positions";
import { createClient } from "@/lib/supabase/server";

export default async function PositionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positions = await getOpenPositions(supabase, user.id);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          보유 포지션
        </h1>
        <PositionsList initialPositions={positions} />
      </div>
    </div>
  );
}
