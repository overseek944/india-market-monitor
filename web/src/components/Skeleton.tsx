export function FeedSkeleton() {
  return (
    <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex gap-1.5">
            <div className="h-4 w-16 rounded bg-zinc-800" />
            <div className="h-4 w-20 rounded bg-zinc-800" />
          </div>
          <div className="mt-2 h-4 w-full rounded bg-zinc-800" />
          <div className="mt-1.5 h-3 w-2/3 rounded bg-zinc-800/60" />
        </div>
      ))}
    </div>
  );
}
