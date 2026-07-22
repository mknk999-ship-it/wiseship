import type { Symbol } from "@/lib/prices";

/** 자산 금액 표시 전용 공통 포맷터. 끝자리 0인 소수점은 자동으로 제거된다. */
function formatAssetNumber(amount: number, maxFractionDigits: number): string {
  const factor = 10 ** maxFractionDigits;
  const rounded = Math.round(amount * factor) / factor;
  return rounded.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatKrw(amount: number): string {
  return `${formatAssetNumber(amount, 0)}원`;
}

export function formatUsdtAmount(amount: number): string {
  return formatAssetNumber(amount, 2);
}

export function formatUsdt(amount: number): string {
  return `${formatUsdtAmount(amount)} USDT`;
}

export function formatUsdtCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return `${formatAssetNumber(amount / 1000, 1)}K USDT`;
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

export function pnlColorClass(pnl: number, neutral = "text-zinc-50"): string {
  if (pnl > 0) return "text-emerald-400";
  if (pnl < 0) return "text-red-400";
  return neutral;
}

export function formatSymbol(symbol: Symbol | string): string {
  return symbol.replace(/-USDT-SWAP$/, "");
}

const KST_DATETIME_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 저장된 시각(UTC ISO 문자열)을 KST 절대시간 "YYYY-MM-DD HH:mm"으로 표시한다. */
export function formatDateTime(isoString: string): string {
  const parts = KST_DATETIME_FORMAT.formatToParts(new Date(isoString));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
