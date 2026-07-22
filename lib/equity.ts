// lib/equity.ts
// "총 평가자산" 공식을 한 곳에 모아 내 계좌 화면과 랭킹(lib/ranking.ts)이 함께 쓰게 한다.
// 데이터 조회 방식(유저 1명 vs 전체 배치)은 호출부마다 다르므로 여기서는 순수 계산만 담당한다.

export function calcTotalEquity(params: {
  walletBalance: number;
  totalMargin: number;
  totalUnrealizedPnl: number;
}): number {
  return params.walletBalance + params.totalMargin + params.totalUnrealizedPnl;
}
