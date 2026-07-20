export function formatKrw(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function formatUsdt(amount: number): string {
  return `${amount.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDT`;
}

export function formatUsdtCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(1)}K USDT`;
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
