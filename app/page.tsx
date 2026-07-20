import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const features = [
  {
    title: "실시간 시세 연동",
    description: "실제 거래소 시세를 그대로 반영해 진짜 시장처럼 연습할 수 있어요.",
  },
  {
    title: "최대 100배 레버리지 선물 체험",
    description: "실전과 동일한 조건으로 레버리지 선물 매매를 위험 없이 경험해보세요.",
  },
  {
    title: "수익률 랭킹 경쟁",
    description: "다른 트레이더들과 수익률을 겨루며 실력을 확인할 수 있어요.",
    href: "/dashboard/ranking",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Wiseship
        </h1>
        <p className="mt-4 text-base text-zinc-400 sm:text-lg">
          실전과 동일한 조건(OKX 수수료·청산 기준)의 코인 선물 모의투자
        </p>

        <Link
          href="/login"
          className="mt-8 inline-block w-full rounded-lg bg-zinc-100 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white sm:w-auto sm:px-8"
        >
          무료로 시작하기
        </Link>
      </div>

      <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:mt-24 sm:grid-cols-3">
        {features.map((feature) =>
          feature.href ? (
            <Link
              key={feature.title}
              href={feature.href}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-left transition hover:border-zinc-600"
            >
              <h2 className="text-sm font-semibold text-zinc-50">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {feature.description}
              </p>
            </Link>
          ) : (
            <div
              key={feature.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-left"
            >
              <h2 className="text-sm font-semibold text-zinc-50">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {feature.description}
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
