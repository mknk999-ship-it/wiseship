export const MIN_DEPOSIT_KRW = 1_000_000;
export const MAX_DEPOSIT_KRW = 100_000_000;

export function validateDepositAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "입금액을 입력해주세요.";
  }
  if (amount < MIN_DEPOSIT_KRW || amount > MAX_DEPOSIT_KRW) {
    return "입금액은 100만원 이상 1억원 이하여야 합니다.";
  }
  return null;
}

export function validateTransferAmount(
  amount: number,
  balance: number,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "이체 금액을 입력해주세요.";
  }
  if (amount > balance) {
    return "잔고를 초과할 수 없습니다.";
  }
  return null;
}

/**
 * RPC 함수가 raise exception으로 던진 코드를 한글 안내로 매핑.
 * 매칭되는 코드가 없으면 원문 노출 없이 일반 안내로 대체한다.
 */
export function mapMarginError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid_amount")) {
    return "입금액은 100만원 이상 1억원 이하여야 합니다.";
  }
  if (m.includes("already_deposited")) {
    return "이미 업비트 입금을 완료했습니다.";
  }
  if (m.includes("already_finalized")) {
    return "이미 OKX 송금을 완료했습니다.";
  }
  if (m.includes("no_balance")) {
    return "전환할 잔고가 없습니다.";
  }
  if (m.includes("insufficient_balance")) {
    return "잔고를 초과할 수 없습니다.";
  }
  if (m.includes("invalid_rate")) {
    return "시세를 불러오지 못했습니다.";
  }
  if (m.includes("invalid_direction")) {
    return "잘못된 이체 방향입니다.";
  }
  if (m.includes("account_not_found") || m.includes("not_authenticated")) {
    return "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요.";
  }
  return "요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
