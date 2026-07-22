export function floorTo2(value: number): number {
  return Math.max(0, Math.floor(value * 100) / 100);
}

/** 소수점 2자리까지만 허용 (여러 개의 '.'이 들어와도 첫 번째만 유지). */
export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
}

/** KRW 전용: 원 단위는 소수점이 없으므로 숫자만 허용. */
export function sanitizeIntegerInput(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}
