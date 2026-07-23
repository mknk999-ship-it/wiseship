"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mapMarginError, validateTransferAmount } from "@/lib/margin";
import { getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type MarginState = {
  error?: string;
  success?: boolean;
};

/**
 * 환율이 개입하는 RPC(buy_usdt/sell_usdt_to_krw) 공통 처리:
 * 서버가 그 순간 재조회한 환율만 신뢰하고, service_role로만 호출 가능한
 * RPC를 대신 호출한 뒤 에러를 매핑한다.
 */
async function callRateRpc(
  rpcName: "buy_usdt" | "sell_usdt_to_krw",
  params: Record<string, unknown>,
): Promise<MarginState> {
  let rate: number;
  try {
    rate = await getUsdtKrw();
  } catch (err) {
    console.error(`[margin:${rpcName}] 환율 조회 실패`, err);
    return { error: "시세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc(rpcName, { ...params, p_rate: rate });
  if (error) return { error: mapMarginError(error, rpcName) };

  return {};
}

/**
 * MAX 버튼(useMax=1)일 때는 클라이언트가 보낸 금액은 물론, 여기서 다시 읽은 잔고값도
 * 실제 이체 금액으로 쓰지 않는다 — supabase-js로 읽는 순간 이미 JS 부동소수점(double)
 * 근사치가 되어서, RPC가 같은 순간 자기 자신이 다시 읽는 Postgres numeric 원본과
 * 미세하게 어긋나 "잔고 초과"로 오탐될 수 있기 때문(실제로 이 문제로 재현됨).
 * 그래서 useMax일 때는 p_amount를 사실상 무시하고 RPC에 p_use_max=true를 넘겨서,
 * RPC 자신이 검증에 쓴 바로 그 값을 이체 금액으로도 그대로 쓰게 한다.
 * 여기서 balance는 "잔고가 아예 없음"을 미리 걸러 불필요한 요청을 줄이는 용도로만 쓴다.
 */
function resolveAmount(
  useMax: boolean,
  clientAmount: number,
  balance: number,
): { amount: number; error?: string } {
  if (useMax) {
    if (!Number.isFinite(balance) || balance <= 0) {
      return { amount: 0, error: "잔고가 부족합니다." };
    }
    return { amount: 0 };
  }

  const validationError = validateTransferAmount(clientAmount, balance);
  if (validationError) return { amount: 0, error: validationError };
  return { amount: clientAmount };
}

/**
 * 회원가입 온보딩: 전원에게 고정 금액(INITIAL_MARGIN_KRW)을 업비트 원화 잔고로 1회
 * 지급한다. redirect() 대신 성공 상태를 반환하는 이유는, 클라이언트가 "입금되었습니다"
 * 안내를 보여준 뒤 대시보드로 이동해야 하기 때문(즉시 리다이렉트하면 안내를 못 봄).
 * 중복 지급 방지는 grant_initial_margin RPC의 행 잠금 + initial_krw 플래그가 담당한다.
 */
export async function grantInitialMargin(
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

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc("grant_initial_margin", {
    p_user_id: user.id,
  });
  if (error) return { error: mapMarginError(error, "grant_initial_margin") };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function buyUsdt(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const useMax = formData.get("useMax") === "1";
  const clientAmount = Number(formData.get("amount"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("upbit_krw")
    .eq("user_id", user.id)
    .single();
  if (!account) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const resolved = resolveAmount(useMax, clientAmount, account.upbit_krw);
  if (resolved.error) return { error: resolved.error };

  const result = await callRateRpc("buy_usdt", {
    p_user_id: user.id,
    p_amount: resolved.amount,
    p_use_max: useMax,
  });
  if (result.error) return result;

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet?tab=upbit&done=buy_usdt");
}

export async function walletTransfer(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const direction = formData.get("direction") as string;
  const useMax = formData.get("useMax") === "1";
  const clientAmount = Number(formData.get("amount"));

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
  const resolved = resolveAmount(useMax, clientAmount, balance);
  if (resolved.error) return { error: resolved.error };

  const { error } = await supabase.rpc("wallet_transfer", {
    p_direction: direction,
    p_amount: resolved.amount,
    p_use_max: useMax,
  });
  if (error) return { error: mapMarginError(error, "wallet_transfer") };

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/wallet?tab=okx&done=${direction}`);
}

export async function withdrawToUpbit(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const useMax = formData.get("useMax") === "1";
  const clientAmount = Number(formData.get("amount"));

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

  const resolved = resolveAmount(useMax, clientAmount, account.okx_funding_usdt);
  if (resolved.error) return { error: resolved.error };

  const { error } = await supabase.rpc("withdraw_to_upbit", {
    p_amount: resolved.amount,
    p_use_max: useMax,
  });
  if (error) return { error: mapMarginError(error, "withdraw_to_upbit") };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet?tab=okx&done=withdraw_to_upbit");
}

export async function depositToOkxFunding(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const useMax = formData.get("useMax") === "1";
  const clientAmount = Number(formData.get("amount"));

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

  const resolved = resolveAmount(useMax, clientAmount, account.upbit_usdt);
  if (resolved.error) return { error: resolved.error };

  const { error } = await supabase.rpc("deposit_to_okx_funding", {
    p_amount: resolved.amount,
    p_use_max: useMax,
  });
  if (error) return { error: mapMarginError(error, "deposit_to_okx_funding") };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet?tab=upbit&done=deposit_to_okx_funding");
}

export async function sellUsdtToKrw(
  _prevState: MarginState,
  formData: FormData,
): Promise<MarginState> {
  const useMax = formData.get("useMax") === "1";
  const clientAmount = Number(formData.get("amount"));

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

  const resolved = resolveAmount(useMax, clientAmount, account.upbit_usdt);
  if (resolved.error) return { error: resolved.error };

  const result = await callRateRpc("sell_usdt_to_krw", {
    p_user_id: user.id,
    p_amount: resolved.amount,
    p_use_max: useMax,
  });
  if (result.error) return result;

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/wallet?tab=upbit&done=sell_usdt_to_krw");
}
