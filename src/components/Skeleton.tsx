export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--line)]/60 ${className}`} />;
}

export function CardGridSkeleton({ n = 12 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl panel p-3">
          <Bar className="aspect-square w-full" />
          <Bar className="mt-2.5 h-3 w-4/5" />
          <Bar className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ n = 6, h = "h-[72px]" }: { n?: number; h?: string }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <Bar key={i} className={`w-full ${h}`} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1220px] px-4 py-6">
      <Bar className="h-3 w-52" />
      <Bar className="mt-4 h-[120px] w-full" />
      <div className="mt-5">
        <CardGridSkeleton />
      </div>
    </div>
  );
}

export function DashSkeleton() {
  return (
    <div className="space-y-4">
      <Bar className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-[76px]" />
        ))}
      </div>
      <RowsSkeleton />
    </div>
  );
}
