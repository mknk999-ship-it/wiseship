import type { Symbol } from "@/lib/prices";

export function formatKrw(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function formatUsdtAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 1e-9;
  return rounded.toLocaleString("ko-KR", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatUsdt(amount: number): string {
  return `${formatUsdtAmount(amount)} USDT`;
}

export function formatUsdtCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    const inK = Math.round((amount / 1000) * 10) / 10;
    const hasFraction = Math.abs(inK % 1) > 1e-9;
    return `${inK.toLocaleString("ko-KR", {
      minimumFractionDigits: hasFraction ? 1 : 0,
      maximumFractionDigits: 1,
    })}K USDT`;
  }
  return formatUsdt(amount);
}

function sign(amount: number): string {
  return amount > 0 ? "+" : amount < 0 ? "-" : "";
}

export function formatSignedUsdt(amount: number): string {
  return `${sign(amount)}${formatUsdt(Math.abs(amount))}`;
}

export function formatSignedKrw(amount: number): string {
  return `${sign(amount)}${formatKrw(Math.abs(amount))}`;
}

export function formatSymbol(symbol: Symbol | string): string {
  return symbol.replace(/-USDT-SWAP$/, "");
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}
