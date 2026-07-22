import { RateErrorRetry } from "@/components/rate-error-retry";
import { SellUsdtForm } from "@/components/sell-usdt-form";
import { WithdrawToUpbitForm } from "@/components/withdraw-to-upbit-form";
import { formatKrw, formatUsdtAmount } from "@/lib/format";

function BalanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[76px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      <p className="text-[10px] text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-zinc-50">
        {value}
      </p>
    </div>
  );
}

export function WithdrawFlow({
  funding,
  upbitUsdt,
  upbitKrw,
  rate,
}: {
  funding: number;
  upbitUsdt: number;
  upbitKrw: number;
  rate: number | null;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <BalanceCard label="OKX Funding" value={`${formatUsdtAmount(funding)} USDT`} />
        <BalanceCard label="업비트 USDT" value={`${formatUsdtAmount(upbitUsdt)} USDT`} />
        <BalanceCard label="업비트 KRW" value={formatKrw(upbitKrw)} />
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">
          OKX Funding → 업비트 USDT
        </p>
        <WithdrawToUpbitForm funding={funding} />
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">
          업비트 USDT → 원화 매도
        </p>
        {rate != null ? (
          <SellUsdtForm upbitUsdt={upbitUsdt} rate={rate} />
        ) : (
          <RateErrorRetry />
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Trading 잔고는 직접 출금할 수 없어요. "이체" 탭에서 먼저 Funding으로
        옮겨주세요.
      </p>
    </div>
  );
}
