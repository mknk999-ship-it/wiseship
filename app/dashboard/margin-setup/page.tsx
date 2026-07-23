import { redirect } from "next/navigation";

import { InitialMarginGrant } from "@/components/initial-margin-grant";
import { createClient } from "@/lib/supabase/server";

export default async function MarginSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("initial_krw")
    .eq("user_id", user.id)
    .single();

  if (!account) redirect("/dashboard");
  if (account.initial_krw !== 0) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          증거금 받기
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-400">
          실전 거래를 시작하기 위한 초기 자금을 받아보세요
        </p>

        <InitialMarginGrant />
      </div>
    </div>
  );
}
