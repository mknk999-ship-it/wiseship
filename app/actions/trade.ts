"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  closePosition,
  isLiquidated,
  openPosition,
  toKrw,
  type Side,
} from "@/lib/engine";
import { getOpenPositionCount } from "@/lib/positions";
import { getOkxMarkPrice, getUsdtKrw } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  isValidCloseRatio,
  isValidSymbol,
  mapTradeError,
  maxAffordableMargin,
  resolvePartialClose,
  validateTpSl,
} from "@/lib/trade";

export type TradeState = {
  error?: string;
};

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function openPositionAction(
  _prevState: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const symbolInput = formData.get("symbol") as string;
  const sideInput = formData.get("side") as string;
  const margin = Number(formData.get("margin"));
  const leverage = Number(formData.get("leverage"));
  const useMax = formData.get("useMax") === "1";
  const tpPrice = parseOptionalNumber(formData.get("tpPrice"));
  const slPrice = parseOptionalNumber(formData.get("slPrice"));

  if (!isValidSymbol(symbolInput)) {
    return { error: "잘못된 종목입니다." };
  }
  if (sideInput !== "long" && sideInput !== "short") {
    return { error: "잘못된 방향입니다." };
  }
  if (!Number.isFinite(margin) || margin <= 0) {
    return { error: "증거금을 입력해주세요." };
  }
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > 100) {
    return { error: "레버리지는 1~100배 범위여야 합니다." };
  }

  const side = sideInput as Side;
  const symbol = symbolInput;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("okx_trading_usdt")
    .eq("user_id", user.id)
    .single();
  if (!account) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  // useMax(100% 진입)일 때는 클라이언트가 보낸 margin을 신뢰하지 않고,
  // 지금 막 조회한 서버 잔고 기준으로 수수료 포함 최대 증거금을 다시 계산한다.
  // 페이지 로드 시점의 클라이언트 잔고와 실제 잔고가 어긋나 있어도 체결 실패로
  // 이어지지 않도록 하기 위함.
  const effectiveMargin = useMax
    ? maxAffordableMargin(account.okx_trading_usdt, leverage)
    : margin;
  if (!Number.isFinite(effectiveMargin) || effectiveMargin <= 0) {
    return { error: "trading 잔고가 부족합니다. (증거금 + 수수료)" };
  }

  const openPositionCount = await getOpenPositionCount(supabase, user.id);

  let markPrice: number;
  try {
    markPrice = await getOkxMarkPrice(symbol);
  } catch {
    return { error: "시세를 불러오지 못했습니다." };
  }

  const result = openPosition({
    symbol,
    side,
    margin: effectiveMargin,
    leverage,
    markPrice,
    tradingBalance: account.okx_trading_usdt,
    openPositionCount,
  });

  if (!result.ok) {
    return { error: result.error ?? "주문을 처리할 수 없습니다." };
  }

  const tpSlCheck = validateTpSl(
    side,
    result.entryPrice ?? markPrice,
    result.liqPrice ?? 0,
    tpPrice,
    slPrice,
  );
  if (tpSlCheck.tpError) return { error: tpSlCheck.tpError };
  if (tpSlCheck.slError) return { error: tpSlCheck.slError };

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc("open_position", {
    p_user_id: user.id,
    p_symbol: symbol,
    p_side: side,
    p_margin: effectiveMargin,
    p_leverage: leverage,
    p_entry_price: result.entryPrice,
    p_qty: result.qty,
    p_notional: result.notional,
    p_open_fee: result.openFee,
    p_liq_price: result.liqPrice,
    p_tp_price: tpPrice,
    p_sl_price: slPrice,
  });

  if (error) return { error: mapTradeError(error.message) };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/positions");
}

export type CloseState = {
  error?: string;
  success?: boolean;
  realizedPnl?: number;
  realizedKrw?: number | null;
  isFullClose?: boolean;
  closeRatio?: number;
  remainingQty?: number | null;
  remainingMargin?: number | null;
};

export async function closePositionAction(
  _prevState: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const positionId = formData.get("positionId") as string;
  if (!positionId) {
    return { error: "포지션을 찾을 수 없습니다." };
  }

  const closeRatio = Number(formData.get("closeRatio"));
  if (!isValidCloseRatio(closeRatio)) {
    return { error: "잘못된 종료 비율입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: position } = await supabase
    .from("positions")
    .select("id, symbol, side, margin, qty, entry_price, status")
    .eq("id", positionId)
    .eq("user_id", user.id)
    .single();

  if (!position) return { error: "포지션을 찾을 수 없습니다." };
  if (position.status !== "open") {
    return { error: "이미 청산된 포지션입니다." };
  }
  if (!isValidSymbol(position.symbol)) {
    return { error: "잘못된 종목입니다." };
  }

  let markPrice: number;
  try {
    markPrice = await getOkxMarkPrice(position.symbol);
  } catch {
    return { error: "시세를 불러오지 못했습니다." };
  }

  const { closedQty, closedMargin, isFullClose } = resolvePartialClose(
    position.qty,
    position.margin,
    closeRatio,
  );

  const result = closePosition(
    position.side as Side,
    position.entry_price,
    markPrice,
    closedQty,
    closedMargin,
  );

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc("close_position", {
    p_user_id: user.id,
    p_position_id: position.id,
    p_close_price: markPrice,
    p_close_fee: result.closeFee,
    p_realized: result.realized,
    p_return_to_balance: result.returnToBalance,
    p_closed_qty: closedQty,
    p_closed_margin: closedMargin,
    p_is_full_close: isFullClose,
  });

  if (error) {
    return { error: mapTradeError(error.message) };
  }

  let realizedKrw: number | null = null;
  try {
    const rate = await getUsdtKrw();
    realizedKrw = toKrw(result.realized, rate);
  } catch {
    realizedKrw = null;
  }

  return {
    success: true,
    realizedPnl: result.realized,
    realizedKrw,
    isFullClose,
    closeRatio,
    remainingQty: isFullClose ? null : position.qty - closedQty,
    remainingMargin: isFullClose ? null : position.margin - closedMargin,
  };
}

export type TpSlState = {
  error?: string;
  success?: boolean;
};

export async function setPositionTpSl(
  _prevState: TpSlState,
  formData: FormData,
): Promise<TpSlState> {
  const positionId = formData.get("positionId") as string;
  const tpPrice = parseOptionalNumber(formData.get("tpPrice"));
  const slPrice = parseOptionalNumber(formData.get("slPrice"));

  if (!positionId) {
    return { error: "포지션을 찾을 수 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data: position } = await supabase
    .from("positions")
    .select("id, symbol, side, liq_price, status")
    .eq("id", positionId)
    .eq("user_id", user.id)
    .single();

  if (!position) return { error: "포지션을 찾을 수 없습니다." };
  if (position.status !== "open") {
    return { error: "이미 청산된 포지션입니다." };
  }
  if (!isValidSymbol(position.symbol)) {
    return { error: "잘못된 종목입니다." };
  }

  let markPrice: number;
  try {
    markPrice = await getOkxMarkPrice(position.symbol);
  } catch {
    return { error: "시세를 불러오지 못했습니다." };
  }

  const tpSlCheck = validateTpSl(
    position.side as Side,
    markPrice,
    position.liq_price,
    tpPrice,
    slPrice,
  );
  if (tpSlCheck.tpError) return { error: tpSlCheck.tpError };
  if (tpSlCheck.slError) return { error: tpSlCheck.slError };

  const { error } = await supabase
    .from("positions")
    .update({ tp_price: tpPrice, sl_price: slPrice })
    .eq("id", position.id)
    .eq("user_id", user.id);

  if (error) return { error: mapTradeError(error.message) };

  return { success: true };
}

export type CancelTpSlTarget = "tp" | "sl" | "both";

export type CancelTpSlResult = {
  error?: string;
  success?: boolean;
  tpPrice?: number | null;
  slPrice?: number | null;
};

export async function cancelPositionTpSl(
  positionId: string,
  target: CancelTpSlTarget,
): Promise<CancelTpSlResult> {
  if (!positionId) {
    return { error: "포지션을 찾을 수 없습니다." };
  }
  if (target !== "tp" && target !== "sl" && target !== "both") {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요." };
  }

  const { data, error } = await supabase.rpc("cancel_tp_sl", {
    p_position_id: positionId,
    p_target: target,
  });

  if (error) return { error: mapTradeError(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: true,
    tpPrice: row?.tp_price ?? null,
    slPrice: row?.sl_price ?? null,
  };
}

export type SettleCheckResult = {
  settled: boolean;
  reason?: "liquidated" | "tp" | "sl";
  realizedPnl?: number;
  realizedKrw?: number | null;
};

/**
 * 포지션 목록 화면이 실시간 마크가격으로 청산/TP/SL 도달을 "감지"했을 때 호출하는
 * 즉시 정산 트리거. 클라이언트가 보낸 판정은 힌트일 뿐이며, 이 함수는 서버에서
 * getOkxMarkPrice로 가격을 다시 조회하고 조건을 처음부터 재검증한다.
 * 조건이 실제로는 충족되지 않았거나 이미 처리된 포지션이면 아무 것도 하지 않고
 * settled: false를 반환한다 (에러로 취급하지 않음 — 1분 주기 크론이 최종 백업).
 */
export async function settleCheckAction(
  positionId: string,
): Promise<SettleCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { settled: false };

  const { data: position } = await supabase
    .from("positions")
    .select("id, symbol, side, margin, qty, entry_price, liq_price, tp_price, sl_price, status")
    .eq("id", positionId)
    .eq("user_id", user.id)
    .single();

  if (!position || position.status !== "open") return { settled: false };
  if (!isValidSymbol(position.symbol)) return { settled: false };

  let markPrice: number;
  try {
    markPrice = await getOkxMarkPrice(position.symbol);
  } catch {
    return { settled: false };
  }

  const side = position.side as Side;
  const serviceClient = createServiceClient();

  if (isLiquidated(side, position.liq_price, markPrice)) {
    const { data: didLiquidate, error } = await serviceClient.rpc(
      "liquidate_position",
      { p_position_id: position.id, p_close_price: markPrice },
    );
    if (error || !didLiquidate) return { settled: false };

    const realized = -position.margin;
    let realizedKrw: number | null = null;
    try {
      const rate = await getUsdtKrw();
      realizedKrw = toKrw(realized, rate);
    } catch {
      realizedKrw = null;
    }

    return { settled: true, reason: "liquidated", realizedPnl: realized, realizedKrw };
  }

  const tpHit =
    position.tp_price != null &&
    (side === "long" ? markPrice >= position.tp_price : markPrice <= position.tp_price);
  const slHit =
    !tpHit &&
    position.sl_price != null &&
    (side === "long" ? markPrice <= position.sl_price : markPrice >= position.sl_price);

  if (!tpHit && !slHit) return { settled: false };

  const result = closePosition(
    side,
    position.entry_price,
    markPrice,
    position.qty,
    position.margin,
  );

  const { error } = await serviceClient.rpc("close_position", {
    p_user_id: user.id,
    p_position_id: position.id,
    p_close_price: markPrice,
    p_close_fee: result.closeFee,
    p_realized: result.realized,
    p_return_to_balance: result.returnToBalance,
    p_closed_qty: position.qty,
    p_closed_margin: position.margin,
    p_is_full_close: true,
    p_reason: tpHit ? "tp" : "sl",
  });

  if (error) return { settled: false };

  let realizedKrw: number | null = null;
  try {
    const rate = await getUsdtKrw();
    realizedKrw = toKrw(result.realized, rate);
  } catch {
    realizedKrw = null;
  }

  return {
    settled: true,
    reason: tpHit ? "tp" : "sl",
    realizedPnl: result.realized,
    realizedKrw,
  };
}
