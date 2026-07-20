"use client";

import { useRouter } from "next/navigation";

import { errorBoxClassName, primaryButtonClassName } from "@/components/ui";

export function RateErrorRetry() {
  const router = useRouter();

  return (
    <div className="space-y-4 text-center">
      <p className={errorBoxClassName}>시세를 불러오지 못했습니다.</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className={primaryButtonClassName}
      >
        다시 시도
      </button>
    </div>
  );
}
