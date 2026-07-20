/**
 * Supabase Auth는 실존하는 이메일 도메인만 허용하므로, 내부적으로는 운영 Gmail 주소에
 * plus-addressing(+아이디)을 붙여 실제 수신 가능한 이메일로 회원가입/로그인한다.
 * 운영 Gmail 주소는 AUTH_EMAIL_GMAIL 환경변수로 관리한다.
 */
function getAuthEmailGmail(): string {
  const value = process.env.AUTH_EMAIL_GMAIL;
  if (!value) {
    throw new Error("AUTH_EMAIL_GMAIL 환경변수가 설정되지 않았습니다.");
  }
  return value;
}

export function usernameToEmail(username: string): string {
  const [localPart] = getAuthEmailGmail().split("@");
  return `${localPart}+${username.trim().toLowerCase()}@gmail.com`;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return "아이디를 입력해주세요.";
  if (trimmed.length < 3) return "아이디는 3자 이상이어야 합니다.";
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return "아이디는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.";
  }
  return null;
}

/**
 * Supabase 인증 에러 원문(영문)을 사용자에게 그대로 노출하지 않기 위한 한글 매핑.
 * 매칭되는 패턴이 없으면 안전한 일반 안내 메시지로 대체한다.
 */
export function mapAuthError(
  message: string,
  context: "login" | "signup",
): string {
  if (context === "login") {
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }

  const m = message.toLowerCase();
  if (m.includes("already") || m.includes("registered")) {
    return "이미 사용 중인 아이디입니다.";
  }
  if (m.includes("password")) {
    return "비밀번호 형식이 올바르지 않습니다.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  return "요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
