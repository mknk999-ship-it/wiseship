// lib/engine.ts
// 매매 엔진: OKX VIP0 무기한 선물 기준의 수수료·청산가·PnL 계산과
// 포지션 오픈/클로즈/강제청산의 순수 로직 (DB 반영은 각 함수 결과로 처리)

// ===== 상수 (OKX VIP0, USDT 무기한) =====
export const TAKER_FEE = 0.0005; // 시장가 = 테이커 0.05%
export const MAKER_FEE = 0.0002; // (참고용) 지정가 0.02% — 요구사항은 시장가만
export const MAX_LEVERAGE = 100;
export const MAX_OPEN_POSITIONS = 5;

// 유지증거금율(MMR): OKX 포지션 티어 1단계 기준 근사값.
// 배포 전 OKX "포지션 티어" 페이지에서 최신 값 확인 후 갱신할 것.
export const MMR: Record<string, number> = {
  "BTC-USDT-SWAP": 0.004, // 0.4%
  "ETH-USDT-SWAP": 0.005, // 0.5%
};

export type Side = "long" | "short";

export interface OpenParams {
  symbol: keyof typeof MMR;
  side: Side;
  margin: number;      // 투입 증거금 (USDT)
  leverage: number;    // 1 ~ 100
  markPrice: number;   // 현재 OKX 마크가격
  tradingBalance: number; // 현재 OKX trading 잔고
  openPositionCount: number;
}

export interface OpenResult {
  ok: boolean;
  error?: string;
  entryPrice?: number;
  qty?: number;        // 코인 수량
  notional?: number;   // 명목가 (margin × leverage)
  openFee?: number;    // 진입 수수료 (잔고에서 즉시 차감)
  liqPrice?: number;   // 청산가
  newTradingBalance?: number; // 오픈 후 trading 잔고 (margin + fee 차감)
}

// ===== 포지션 오픈 =====
export function openPosition(p: OpenParams): OpenResult {
  if (p.openPositionCount >= MAX_OPEN_POSITIONS)
    return { ok: false, error: `포지션은 최대 ${MAX_OPEN_POSITIONS}개까지 가능합니다.` };
  if (p.leverage < 1 || p.leverage > MAX_LEVERAGE)
    return { ok: false, error: `레버리지는 1~${MAX_LEVERAGE}배 범위여야 합니다.` };

  const notional = p.margin * p.leverage;
  const openFee = notional * TAKER_FEE;
  const required = p.margin + openFee;
  if (required > p.tradingBalance)
    return { ok: false, error: "trading 잔고가 부족합니다. (증거금 + 수수료)" };

  const qty = notional / p.markPrice;
  const liqPrice = calcLiqPrice(p.side, p.markPrice, p.leverage, MMR[p.symbol]);

  return {
    ok: true,
    entryPrice: p.markPrice,
    qty,
    notional,
    openFee,
    liqPrice,
    newTradingBalance: p.tradingBalance - required,
  };
}

// ===== 청산가 (격리마진, 수수료 제외 근사 — OKX 공식과 동일 구조) =====
// 롱:  liq = entry × (1 − 1/lev) ÷ (1 − mmr)
// 숏:  liq = entry × (1 + 1/lev) ÷ (1 + mmr)
export function calcLiqPrice(
  side: Side,
  entry: number,
  leverage: number,
  mmr: number
): number {
  return side === "long"
    ? (entry * (1 - 1 / leverage)) / (1 - mmr)
    : (entry * (1 + 1 / leverage)) / (1 + mmr);
}

// ===== 미실현 손익 =====
export function unrealizedPnl(
  side: Side,
  entry: number,
  mark: number,
  qty: number
): number {
  return side === "long" ? (mark - entry) * qty : (entry - mark) * qty;
}

// 수익률 (ROE, 증거금 대비 %)
export function roePercent(pnl: number, margin: number): number {
  return (pnl / margin) * 100;
}

// ===== 포지션 클로즈 (시장가 전량 청산) =====
export interface CloseResult {
  closeFee: number;
  pnl: number;          // 수수료 차감 전
  realized: number;     // 수수료 차감 후 실현손익
  returnToBalance: number; // trading 잔고로 돌아가는 금액 (margin + realized, 최소 0)
}

export function closePosition(
  side: Side,
  entry: number,
  mark: number,
  qty: number,
  margin: number
): CloseResult {
  const pnl = unrealizedPnl(side, entry, mark, qty);
  const closeFee = mark * qty * TAKER_FEE;
  const realized = pnl - closeFee;
  const returnToBalance = Math.max(0, margin + realized);
  return { closeFee, pnl, realized, returnToBalance };
}

// ===== 강제청산 판정 =====
// 마크가격이 청산가에 도달하면 true → 포지션 status='liquidated',
// 증거금은 요구사항대로 0원 처리 (returnToBalance 없음), realized_pnl = -margin
export function isLiquidated(side: Side, liqPrice: number, mark: number): boolean {
  return side === "long" ? mark <= liqPrice : mark >= liqPrice;
}

// ===== 원화 병기 표시 =====
export function toKrw(usdt: number, usdtKrwRate: number): number {
  return usdt * usdtKrwRate;
}

// 화면 표시 예:
//   const pnl = unrealizedPnl(...);
//   `${pnl.toFixed(2)} USDT (${toKrw(pnl, rate).toLocaleString("ko-KR", {maximumFractionDigits: 0})}원)`
