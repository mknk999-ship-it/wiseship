import type { Side } from "@/lib/engine";
import type { Symbol } from "@/lib/prices";

export function isValidSymbol(value: string): value is Symbol {
  return value === "BTC-USDT-SWAP" || value === "ETH-USDT-SWAP";
}

export type TpSlCheck = {
  tpError?: string;
  slError?: string;
  liqWarning?: string;
};

/**
 * TP/SL 입력값을 현재가·청산가 기준으로 검증한다.
 * tpError/slError는 저장을 막는 오류, liqWarning은 저장은 허용하되 보여주는 경고
 * (SL이 청산가보다 청산 쪽에 있어 청산가에 먼저 도달하는 경우).
 */
export function validateTpSl(
  side: Side,
  currentPrice: number,
  liqPrice: number,
  tpPrice: number | null,
  slPrice: number | null,
): TpSlCheck {
  const result: TpSlCheck = {};

  if (tpPrice != null) {
    if (side === "long" && tpPrice <= currentPrice) {
      result.tpError = "TP는 현재가보다 높아야 합니다.";
    }
    if (side === "short" && tpPrice >= currentPrice) {
      result.tpError = "TP는 현재가보다 낮아야 합니다.";
    }
  }

  if (slPrice != null) {
    if (side === "long" && slPrice >= currentPrice) {
      result.slError = "SL은 현재가보다 낮아야 합니다.";
    }
    if (side === "short" && slPrice <= currentPrice) {
      result.slError = "SL은 현재가보다 높아야 합니다.";
    }

    const crossesLiq =
      side === "long" ? slPrice <= liqPrice : slPrice >= liqPrice;
    if (crossesLiq) {
      result.liqWarning = "청산가에 먼저 도달합니다.";
    }
  }

  return result;
}

/**
 * open_position/close_position RPC가 raise exception으로 던진 코드를 한글 안내로 매핑.
 * 매칭되는 코드가 없으면 원문 노출 없이 일반 안내로 대체한다.
 */
export function mapTradeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("max_positions")) {
    return "포지션은 최대 5개까지 가능합니다.";
  }
  if (m.includes("insufficient_balance")) {
    return "trading 잔고가 부족합니다. (증거금 + 수수료)";
  }
  if (m.includes("invalid_leverage")) {
    return "레버리지는 1~100배 범위여야 합니다.";
  }
  if (m.includes("invalid_amount")) {
    return "증거금을 입력해주세요.";
  }
  if (m.includes("invalid_symbol") || m.includes("invalid_side")) {
    return "잘못된 주문입니다.";
  }
  if (m.includes("account_not_found")) {
    return "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요.";
  }
  if (m.includes("position_not_found")) {
    return "포지션을 찾을 수 없습니다.";
  }
  if (m.includes("already_closed")) {
    return "이미 청산된 포지션입니다.";
  }
  return "요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
