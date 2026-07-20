import { redirect } from "next/navigation";

import { BuyUsdtForm } from "@/components/buy-usdt-form";
import { DepositForm } from "@/components/deposit-form";
import { MarginStepIndicator } from "@/components/margin-step-indicator";
import { RateErrorRetry } from "@/components/rate-error-retry";
import { TransferForm } from "@/components/transfer-form";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";

async function BuyUsdtStep() {
  let rate: number;
  try {
    rate = await getUsdtKrw();
  } catch {
    return <RateErrorRetry />;
  }

  return <BuyUsdtForm rate={rate} />;
}

export default async function MarginSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("upbit_krw, upbit_usdt, initial_krw, initial_usdt")
    .eq("user_id", user.id)
    .single();

  if (!account) redirect("/dashboard");
  if (account.initial_usdt !== 0) redirect("/dashboard");

  const step = account.initial_krw === 0 ? 1 : account.upbit_usdt === 0 ? 2 : 3;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          증거금 설정
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-400">
          실전 거래를 시작하기 위한 초기 자금을 준비해주세요
        </p>

        <MarginStepIndicator step={step} />

        {step === 1 && <DepositForm />}
        {step === 2 && <BuyUsdtStep />}
        {step === 3 && <TransferForm balance={account.upbit_usdt} />}
      </div>
    </div>
  );
}
