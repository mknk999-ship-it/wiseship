"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const REFRESH_INTERVAL_MS = 60000;

/**
 * 크론(강제청산/TP/SL)처럼 유저 행동 없이 서버에서 발생하는 변경을 반영하기 위해
 * 헤더(레이아웃) + 현재 페이지 데이터를 주기적으로/페이지 이동 시 새로고침한다.
 * 화면에 아무것도 렌더링하지 않는다.
 */
export function DashboardRefresher() {
  const router = useRouter();
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
