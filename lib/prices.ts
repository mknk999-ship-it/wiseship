// lib/prices.ts
// 시세 연동: OKX 마크가격(BTC/ETH 무기한) + 업비트 USDT/KRW
// 브라우저에서 직접 호출해도 되고(둘 다 퍼블릭 API), CORS 문제가 생기면
// Next.js API Route(/app/api/prices/route.ts)로 프록시하면 됩니다.

export type Symbol = "BTC-USDT-SWAP" | "ETH-USDT-SWAP";

// --- OKX 마크가격 (청산/PnL 기준가는 마크가격을 쓰는 것이 OKX 와 동일) ---
export async function getOkxMarkPrice(symbol: Symbol): Promise<number> {
  const res = await fetch(
    `https://www.okx.com/api/v5/public/mark-price?instId=${symbol}`,
    { cache: "no-store" }
  );
  const json = await res.json();
  return parseFloat(json.data[0].markPx);
}

// --- 업비트 USDT/KRW 환율 ---
export async function getUsdtKrw(): Promise<number> {
  const res = await fetch(
    "https://api.upbit.com/v1/ticker?markets=KRW-USDT",
    { cache: "no-store" }
  );
  const json = await res.json();
  return json[0].trade_price;
}

// --- 실시간이 필요한 화면(포지션 목록 등)은 OKX WebSocket 권장 ---
// 사용 예: subscribeMarkPrice(["BTC-USDT-SWAP","ETH-USDT-SWAP"], (s, px) => setPrice(s, px))
export function subscribeMarkPrice(
  symbols: Symbol[],
  onPrice: (symbol: Symbol, price: number) => void
): () => void {
  const ws = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        op: "subscribe",
        args: symbols.map((s) => ({ channel: "mark-price", instId: s })),
      })
    );
  };
  ws.onmessage = (ev) => {
    if (ev.data === "pong") return;
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.data?.[0]?.markPx) {
      onPrice(msg.arg.instId as Symbol, parseFloat(msg.data[0].markPx));
    }
  };
  // 25초마다 ping (OKX 는 30초 무응답 시 연결 종료)
  const ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 25000);
  return () => {
    clearInterval(ping);
    ws.close();
  };
}
