export function BalanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[76px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      <p className="whitespace-nowrap text-[10px] text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-zinc-50">
        {value}
      </p>
    </div>
  );
}
