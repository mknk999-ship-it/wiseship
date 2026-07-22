"use client";

import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  type CandlestickData,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  TIMEFRAMES,
  TIMEFRAME_LABEL,
  bucketStart,
  getOkxCandles,
  type CandleBar,
  type Timeframe,
} from "@/lib/candles";
import type { OpenPosition } from "@/lib/positions";
import type { Symbol } from "@/lib/prices";

function toBarData(bar: CandleBar): CandlestickData {
  return {
    time: bar.time as UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
}

function positionKey(positions: OpenPosition[]): string {
  return positions
    .map(
      (p) =>
        `${p.id}:${p.side}:${p.entry_price}:${p.liq_price}:${p.tp_price}:${p.sl_price}`,
    )
    .join("|");
}

function formatLabelPrice(price: number): string {
  return Math.round(price).toLocaleString("ko-KR");
}

// 라벨 div의 대략적인 렌더링 높이(px). 가격선 바로 위에 띄우기 위한 오프셋 계산용.
const LABEL_HEIGHT_PX = 18;
const LABEL_GAP_PX = 4;

type ChartLabel = {
  key: string;
  top: number;
  text: string;
  color: string;
};

export function PriceChart({
  symbol,
  markPrice,
  positions,
}: {
  symbol: Symbol;
  markPrice: number | null;
  positions: OpenPosition[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastBarRef = useRef<CandleBar | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const positionsRef = useRef<OpenPosition[]>(positions);
  positionsRef.current = positions;

  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<ChartLabel[]>([]);

  const recomputeLabels = useCallback(() => {
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!series || !container) {
      setLabels([]);
      return;
    }
    const height = container.getBoundingClientRect().height;
    const next: ChartLabel[] = [];

    const addLabel = (
      keySuffix: string,
      price: number,
      text: string,
      color: string,
    ) => {
      const y = series.priceToCoordinate(price);
      if (y == null || y < 0 || y > height) return;
      const top = y - LABEL_HEIGHT_PX - LABEL_GAP_PX;
      next.push({ key: keySuffix, top, text, color });
    };

    for (const position of positionsRef.current) {
      const sideLabel = position.side === "long" ? "롱" : "숏";
      addLabel(
        `${position.id}:entry`,
        position.entry_price,
        `진입 ${formatLabelPrice(position.entry_price)} · ${sideLabel}`,
        "#e4e4e7",
      );
      addLabel(
        `${position.id}:liq`,
        position.liq_price,
        `청산 ${formatLabelPrice(position.liq_price)}`,
        "#f87171",
      );
      if (position.tp_price != null) {
        addLabel(
          `${position.id}:tp`,
          position.tp_price,
          `TP ${formatLabelPrice(position.tp_price)}`,
          "#34d399",
        );
      }
      if (position.sl_price != null) {
        addLabel(
          `${position.id}:sl`,
          position.sl_price,
          `SL ${formatLabelPrice(position.sl_price)}`,
          "#fb923c",
        );
      }
    }

    setLabels(next);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialRect = container.getBoundingClientRect();
    const chart = createChart(container, {
      width: Math.max(1, Math.floor(initialRect.width)),
      height: Math.max(1, Math.floor(initialRect.height)),
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "rgba(63,63,70,0.35)" },
        horzLines: { color: "rgba(63,63,70,0.35)" },
      },
      rightPriceScale: { borderColor: "#3f3f46" },
      timeScale: {
        borderColor: "#3f3f46",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });

    seriesRef.current = series;

    const handleVisibleRangeChange = () => recomputeLabels();
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.resize(Math.floor(width), Math.floor(height));
        recomputeLabels();
      }
    });
    resizeObserver.observe(container);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      resizeObserver.disconnect();
      chart.remove();
      seriesRef.current = null;
      lastBarRef.current = null;
      priceLinesRef.current = [];
    };
  }, [recomputeLabels]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getOkxCandles(symbol, timeframe)
      .then((bars) => {
        if (cancelled) return;
        const series = seriesRef.current;
        if (!series) return;
        series.setData(bars.map(toBarData));
        lastBarRef.current = bars[bars.length - 1] ?? null;
        recomputeLabels();
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, recomputeLabels]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || markPrice == null) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = bucketStart(nowSec, timeframe);
    const last = lastBarRef.current;

    let updated: CandleBar;
    if (!last || bucket > last.time) {
      updated = {
        time: bucket,
        open: markPrice,
        high: markPrice,
        low: markPrice,
        close: markPrice,
      };
    } else if (bucket === last.time) {
      updated = {
        ...last,
        high: Math.max(last.high, markPrice),
        low: Math.min(last.low, markPrice),
        close: markPrice,
      };
    } else {
      return;
    }

    lastBarRef.current = updated;
    series.update(toBarData(updated));
    recomputeLabels();
  }, [markPrice, timeframe, recomputeLabels]);

  const positionsSignature = positionKey(positions);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];

    for (const position of positionsRef.current) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: position.entry_price,
          color: "#e4e4e7",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: "",
        }),
      );
      priceLinesRef.current.push(
        series.createPriceLine({
          price: position.liq_price,
          color: "#f87171",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "",
        }),
      );
      if (position.tp_price != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: position.tp_price,
            color: "#34d399",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: "",
          }),
        );
      }
      if (position.sl_price != null) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: position.sl_price,
            color: "#fb923c",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: "",
          }),
        );
      }
    }

    recomputeLabels();
    // positionsRef always holds the latest positions; re-run only when the
    // relevant fields actually change (positionsSignature), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsSignature, recomputeLabels]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-800/60 p-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              timeframe === tf
                ? "bg-zinc-700 text-zinc-50 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {TIMEFRAME_LABEL[tf]}
          </button>
        ))}
      </div>

      <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 sm:h-[360px]">
        <div ref={containerRef} className="h-full w-full" />

        {labels.map((label) => (
          <div
            key={label.key}
            className="pointer-events-none absolute left-2 whitespace-nowrap rounded border border-zinc-700 bg-zinc-950/80 px-1.5 py-0.5 text-[10px] font-medium"
            style={{ top: label.top, color: label.color }}
          >
            {label.text}
          </div>
        ))}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 text-sm text-zinc-400">
            차트 불러오는 중...
          </div>
        )}
      </div>
    </div>
  );
}
