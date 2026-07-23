// 회원가입 온보딩에서 전원에게 고정으로 지급하는 증거금(원화). 랭킹 수익률 계산의
// 기준값으로도 재사용한다(lib/ranking.ts).
export const INITIAL_MARGIN_KRW = 10_000_000;

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

export type MarginRpcError = {
  code?: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * RPC 호출 실패를 한글 안내로 매핑. 원본 에러(code/message/details/hint)는
 * 어떤 경우든 서버 콘솔에 남기고, 사용자에게는 원인별로 다른 문구를 보여준다.
 * 어느 케이스에도 안 걸리는 예상 못 한 에러만 마지막 일반 문구로 대체한다.
 * `context`는 어느 액션/RPC에서 난 에러인지 로그에서 구분하기 위한 라벨.
 */
export function mapMarginError(error: MarginRpcError, context: string): string {
  console.error(`[margin:${context}]`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  const code = error.code;
  const m = error.message.toLowerCase();

  // PostgREST가 스키마 캐시에서 함수를 못 찾음(신규/변경된 RPC가 DB에 아직 반영 안 됨)
  // 또는 Postgres의 undefined_function — 사용자가 고칠 수 있는 문제가 아니라 서버 쪽 문제.
  if (code === "PGRST202" || code === "42883") {
    return "일시적인 서버 설정 문제로 요청을 처리할 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.";
  }
  // Postgres insufficient_privilege — 잘못된 권한으로 RPC를 호출한 경우(서비스롤 전용 함수 등).
  if (code === "42501") {
    return "이 작업을 수행할 권한이 없습니다.";
  }

  if (m.includes("invalid_rate")) {
    return "시세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (m.includes("no_balance") || m.includes("insufficient_balance")) {
    return "잔고가 부족합니다.";
  }
  if (m.includes("invalid_amount")) {
    return "최소 금액 미만입니다. 금액을 다시 확인해주세요.";
  }
  if (m.includes("already_deposited")) {
    return "이미 업비트 입금을 완료했습니다.";
  }
  if (m.includes("already_finalized")) {
    return "이미 OKX 송금을 완료했습니다.";
  }
  if (m.includes("already_granted")) {
    return "이미 증거금을 받았습니다.";
  }
  if (m.includes("invalid_direction")) {
    return "잘못된 이체 방향입니다.";
  }
  if (m.includes("account_not_found") || m.includes("not_authenticated")) {
    return "계정 정보를 확인할 수 없습니다. 다시 로그인해주세요.";
  }

  return "요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
