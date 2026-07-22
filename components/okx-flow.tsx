import { SingleWalletTransferForm } from "@/components/single-wallet-transfer-form";
import { WithdrawToUpbitForm } from "@/components/withdraw-to-upbit-form";

export function OkxFlow({
  funding,
  trading,
}: {
  funding: number;
  trading: number;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">Funding → Trading 변환</p>
        <SingleWalletTransferForm
          direction="funding_to_trading"
          balance={funding}
          submitLabel="Trading으로 이체"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">Trading → Funding 변환</p>
        <SingleWalletTransferForm
          direction="trading_to_funding"
          balance={trading}
          submitLabel="Funding으로 이체"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm font-medium text-zinc-300">
          업비트로 송금 (OKX Funding → 업비트 USDT)
        </p>
        <p className="text-xs text-zinc-500">
          Trading 잔고는 먼저 Funding으로 변환해야 송금 가능해요.
        </p>
        <WithdrawToUpbitForm funding={funding} />
      </div>
    </div>
  );
}
