import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "./env";

/**
 * RLS를 완전히 우회하는 서비스롤 클라이언트. 서버 전용 — 절대 클라이언트 컴포넌트나
 * 브라우저로 전달되는 코드 경로에서 import하지 말 것. open_position처럼
 * authenticated/anon 실행 권한이 revoke된 RPC를 호출할 때만 사용한다.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }
  return createSupabaseClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
