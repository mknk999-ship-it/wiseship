import Link from "next/link";

export function PaginationLinks({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link
          href={makeHref(page - 1)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-600"
        >
          이전
        </Link>
      ) : (
        <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-600">
          이전
        </span>
      )}
      <span className="text-zinc-400">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={makeHref(page + 1)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-600"
        >
          다음
        </Link>
      ) : (
        <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-600">
          다음
        </span>
      )}
    </div>
  );
}
