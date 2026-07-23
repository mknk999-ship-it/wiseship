// lib/candles.ts
// 차트용 캔들 데이터: OKX 마크가격 캔들(REST) 조회.
// 청산가/PnL이 마크가격 기준이라 체결가 캔들 대신 mark-price-candles를 사용해 기준을 일치시킨다.
// 과거 구간(무한 스크롤)도 같은 이유로 history-candles가 아니라 history-mark-price-candles를 쓴다.
// prices.ts와 동일하게 브라우저에서 직접 호출한다(퍼블릭 API, cache: "no-store").

import type { Symbol } from "@/lib/prices";

export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D"];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1m": "1분",
  "5m": "5분",
  "15m": "15분",
  "1H": "1시간",
  "4H": "4시간",
  "1D": "일",
};

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1H": 60 * 60,
  "4H": 4 * 60 * 60,
  "1D": 24 * 60 * 60,
};

// OKX는 1H 이상 봉을 UTC+8(HK) 기준으로 정렬한다. 1m/5m/15m은 UTC 그대로 정렬.
const HK_OFFSET_SEC = 8 * 60 * 60;

export function bucketStart(epochSec: number, timeframe: Timeframe): number {
  const size = TIMEFRAME_SECONDS[timeframe];
  if (timeframe === "1H" || timeframe === "4H" || timeframe === "1D") {
    const shifted = epochSec + HK_OFFSET_SEC;
    return Math.floor(shifted / size) * size - HK_OFFSET_SEC;
  }
  return Math.floor(epochSec / size) * size;
}

export type CandleBar = {
  time: number; // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

// OKX 마크가격 캔들 엔드포인트(라이브·히스토리 공통)의 실측 최대 limit.
export const MAX_CANDLE_LIMIT = 300;

function parseCandleRows(rows: string[][]): CandleBar[] {
  return rows
    .map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
    }))
    .reverse();
}

export async function getOkxCandles(
  symbol: Symbol,
  timeframe: Timeframe,
  limit: number = MAX_CANDLE_LIMIT,
): Promise<CandleBar[]> {
  const res = await fetch(
    `https://www.okx.com/api/v5/market/mark-price-candles?instId=${symbol}&bar=${timeframe}&limit=${limit}`,
    { cache: "no-store" },
  );
  const json = await res.json();
  return parseCandleRows(json.data ?? []);
}

/**
 * 무한 스크롤로 더 과거 구간을 이어 받을 때 쓰는 히스토리 캔들 조회.
 * beforeMs(ms epoch)보다 과거 데이터를 반환한다 — OKX의 `after` 파라미터가
 * "이 시각보다 이전 데이터"를 의미한다(신규→과거 순으로 페이지네이션하는 이름이라
 * 다소 헷갈리지만, 실제 호출로 겹침·공백 없이 이어짐을 확인했다).
 */
export async function getOkxHistoricalCandles(
  symbol: Symbol,
  timeframe: Timeframe,
  beforeMs: number,
  limit: number = MAX_CANDLE_LIMIT,
): Promise<CandleBar[]> {
  const res = await fetch(
    `https://www.okx.com/api/v5/market/history-mark-price-candles?instId=${symbol}&bar=${timeframe}&after=${beforeMs}&limit=${limit}`,
    { cache: "no-store" },
  );
  const json = await res.json();
  return parseCandleRows(json.data ?? []);
}
