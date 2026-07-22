"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { logout } from "@/app/actions/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/dashboard/trade", label: "트레이드" },
  { href: "/dashboard/positions", label: "포지션 현황" },
  { href: "/dashboard/wallet", label: "지갑 관리" },
  { href: "/dashboard/ranking", label: "랭킹" },
];

export function NavMenu({
  nickname,
  openPositionCount,
}: {
  nickname: string;
  openPositionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-50"
      >
        <span className="text-lg leading-none">≡</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-20">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-64 max-w-[80vw] flex-col border-l border-zinc-800 bg-zinc-950 p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-50">메뉴</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:text-zinc-100"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active =
                  link.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-zinc-800 text-zinc-50"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.href === "/dashboard/positions" && (
                      <span className="text-xs text-zinc-400">
                        {openPositionCount}/5
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-zinc-800 pt-4">
              <p className="px-3 text-sm text-zinc-400">{nickname}님</p>
              <form action={logout} className="mt-2">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-left text-sm font-medium text-zinc-300 transition hover:border-red-800 hover:text-red-300"
                >
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
