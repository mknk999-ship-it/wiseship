const STEPS = [
  { n: 1, label: "업비트 입금" },
  { n: 2, label: "USDT 매수" },
  { n: 3, label: "OKX 송금" },
] as const;

export function MarginStepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
              step === s.n
                ? "bg-zinc-100 text-zinc-900"
                : step > s.n
                  ? "bg-zinc-700 text-zinc-300"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {s.n}
          </div>
          <span
            className={`hidden text-xs sm:inline ${
              step === s.n ? "text-zinc-100" : "text-zinc-500"
            }`}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-6 bg-zinc-700" />}
        </div>
      ))}
    </div>
  );
}
