"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mapMarginError, validateDepositAmount, validateTransferAmount } from "@/lib/margin";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  let rate: number;
  try {
    rate = await getUsdtKrw();
  } catch {
    return { error: "시세를 불러오지 못했습니다." };
  }

  // buy_usdt_all은 sell_usdt_to_krw와 동일한 이유로 서비스롤 전용으로 잠겨 있다
  // (사용자가 자기 JWT로 직접 호출해 p_rate를 조작하는 것을 막기 위함).
  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc("buy_usdt_all", {
    p_user_id: user.id,
    p_rate: rate,
  });
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

export async function withdrawToUpbit(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const amount = Number(formData.get("amount"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_funding_usdt")
    .eq("user_id", user.id)
    .single();
  if (!account) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const validationError = validateTransferAmount(
    amount,
    account.okx_funding_usdt,
  );
  if (validationError) return { error: validationError };

  const { error } = await supabase.rpc("withdraw_to_upbit", {
    p_amount: amount,
  });
  if (error) return { error: mapMarginError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet");
}

export async function sellUsdtToKrw(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const amount = Number(formData.get("amount"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("upbit_usdt")
    .eq("user_id", user.id)
    .single();
  if (!account) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const validationError = validateTransferAmount(amount, account.upbit_usdt);
  if (validationError) return { error: validationError };

  // 화면에 보여준 환율은 참고용일 뿐, 체결에는 이 시점에 새로 조회한 환율만 사용한다.
  let rate: number;
  try {
    rate = await getUsdtKrw();
  } catch {
    return { error: "시세를 불러오지 못했습니다." };
  }

  // sell_usdt_to_krw는 open_position과 동일하게 서비스롤 전용으로 잠겨 있어(사용자가
  // 자기 JWT로 직접 호출해 p_rate를 조작하는 것을 막기 위함), 여기서만 호출 가능하다.
  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc("sell_usdt_to_krw", {
    p_user_id: user.id,
    p_amount: amount,
    p_rate: rate,
  });
  if (error) return { error: mapMarginError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet");
}
