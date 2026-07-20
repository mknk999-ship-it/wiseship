"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mapMarginError, validateDepositAmount, validateTransferAmount } from "@/lib/margin";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";

export type MarginState = {
  error?: string;
};

export async function depositUpbitKrw(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const amount = Number(formData.get("amount"));
  const validationError = validateDepositAmount(amount);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("deposit_upbit_krw", {
    p_amount: amount,
  });
  if (error) return { error: mapMarginError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/margin-setup");
}

export async function buyUsdtAll(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: MarginState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<MarginState> {
  let rate: number;
  try {
    rate = await getUsdtKrw();
  } catch {
    return { error: "시세를 불러오지 못했습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("buy_usdt_all", { p_rate: rate });
  if (error) return { error: mapMarginError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/margin-setup");
}

export async function transferToOkxFunding(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: MarginState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<MarginState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_to_okx_funding");
  if (error) return { error: mapMarginError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function walletTransfer(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const direction = formData.get("direction") as string;
  const amount = Number(formData.get("amount"));

  if (
    direction !== "funding_to_trading" &&
    direction !== "trading_to_funding"
  ) {
    return { error: "잘못된 이체 방향입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_funding_usdt, okx_trading_usdt")
    .eq("user_id", user.id)
    .single();
  if (!account) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const balance =
    direction === "funding_to_trading"
      ? account.okx_funding_usdt
      : account.okx_trading_usdt;
  const validationError = validateTransferAmount(amount, balance);
  if (validationError) return { error: validationError };

  const { error } = await supabase.rpc("wallet_transfer", {
    p_direction: direction,
    p_amount: amount,
  });
  if (error) return { error: mapMarginError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet");
}
