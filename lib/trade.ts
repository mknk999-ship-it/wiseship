import { TAKER_FEE } from "@/lib/engine";
import type { Side } from "@/lib/engine";
import type { Symbol } from "@/lib/prices";

export function isValidSymbol(value: string): value is Symbol {
  return value === "BTC-USDT-SWAP" || value === "ETH-USDT-SWAP";
}

// 100% 진입 시 수수료까지 포함해 실제로 체결 가능한 최대 증거금.
// 소수 2자리 내림 + 부동소수점 오차 대비 안전버퍼(0.01 USDT)를 뺀다.
const MAX_MARGIN_SAFETY_BUFFER = 0.01;

function floorTo2(value: number): number {
  return Math.floor(value * 100) / 100;
}

/**
 * 클라이언트(증거금 비율 버튼 미리보기)와 서버(주문 처리 액션) 양쪽에서
 * 동일한 잔고를 넣고 호출해야 같은 결과가 나온다. 서버에서 호출할 때는
 * 항상 그 시점에 새로 조회한 계정 잔고를 넘겨서, 클라이언트가 들고 있던
 * (페이지 로드 시점의) 잔고와 어긋나도 체결 실패로 이어지지 않게 한다.
 */
export function maxAffordableMargin(balance: number, leverage: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  if (!Number.isFinite(leverage) || leverage <= 0) return 0;

  const raw = balance / (1 + leverage * TAKER_FEE);
  const floored = floorTo2(raw);
  const buffered = floorTo2(floored - MAX_MARGIN_SAFETY_BUFFER);
  return Math.max(0, buffered);
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

// 포지션 부분 종료 허용 비율. 서버가 화이트리스트로 검증해 임의 값을 거부한다.
export const CLOSE_RATIOS = [0.25, 0.5, 0.75, 1] as const;
export type CloseRatio = (typeof CLOSE_RATIOS)[number];

export function isValidCloseRatio(value: number): value is CloseRatio {
  return (CLOSE_RATIOS as readonly number[]).includes(value);
}

// 종료 후 잔여 수량이 이 값 미만이면 전량 종료로 처리한다 (심볼 공통).
export const MIN_POSITION_QTY = 0.001;

export type PartialCloseResolution = {
  closedQty: number;
  closedMargin: number;
  isFullClose: boolean;
};

/**
 * 종료 비율로부터 실제로 종료할 qty/margin과 전량 종료 여부를 계산한다.
 * 잔여 수량이 최소 주문 단위(MIN_POSITION_QTY) 미만이 되면 비율과 무관하게
 * 전량 종료로 승격시킨다. 클라이언트(미리보기)와 서버(실제 처리) 양쪽에서
 * 동일하게 호출해 결과가 어긋나지 않게 한다.
 */
export function resolvePartialClose(
  qty: number,
  margin: number,
  ratio: number,
): PartialCloseResolution {
  const remainingQty = qty * (1 - ratio);
  const isFullClose = ratio >= 1 || (remainingQty > 0 && remainingQty < MIN_POSITION_QTY);

  if (isFullClose) {
    return { closedQty: qty, closedMargin: margin, isFullClose: true };
  }

  return { closedQty: qty * ratio, closedMargin: margin * ratio, isFullClose: false };
}

// 예상이익:예상손실을 손실=1 기준으로 정규화한 손익비. 한쪽 값이 없거나 손실이 0이면 null.
// 포지션 카드(SL 기준)와 TP/SL 편집 화면(TP/SL 기준) 양쪽에서 재사용한다.
export function profitLossRatio(
  expectedProfit: number | null,
  expectedLoss: number | null,
): number | null {
  if (expectedProfit == null || expectedLoss == null || expectedLoss === 0) {
    return null;
  }
  return Math.abs(expectedProfit) / Math.abs(expectedLoss);
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
  if (m.includes("invalid_sl_price")) {
    return "올바른 SL 가격을 입력해주세요.";
  }
  if (m.includes("already_closed")) {
    return "이미 청산된 포지션입니다.";
  }
  return "요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
