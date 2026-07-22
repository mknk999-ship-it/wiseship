import { BuyUsdtPartialForm } from "@/components/buy-usdt-partial-form";
import { DepositToOkxFundingForm } from "@/components/deposit-to-okx-funding-form";
import { RateErrorRetry } from "@/components/rate-error-retry";
import { SellUsdtForm } from "@/components/sell-usdt-form";

export function UpbitFlow({
  upbitKrw,
  upbitUsdt,
  rate,
}: {
  upbitKrw: number;
  upbitUsdt: number;
  rate: number | null;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">
          USDT 구매 (KRW → USDT)
        </p>
        {rate != null ? (
          <BuyUsdtPartialForm upbitKrw={upbitKrw} rate={rate} />
        ) : (
          <RateErrorRetry />
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">
          USDT 판매 (USDT → KRW)
        </p>
        {rate != null ? (
          <SellUsdtForm upbitUsdt={upbitUsdt} rate={rate} />
        ) : (
          <RateErrorRetry />
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">
          OKX로 송금 (업비트 USDT → OKX Funding)
        </p>
        <DepositToOkxFundingForm upbitUsdt={upbitUsdt} />
      </div>
    </div>
  );
}
