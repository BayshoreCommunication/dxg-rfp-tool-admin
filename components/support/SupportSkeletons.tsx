/**
 * Loading states that mirror the real Support layouts, so the page does not
 * jump when data arrives. Pure markup: safe in server and client components.
 */
const bone = "animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/40";
const card = "rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

export const SupportHeaderSkeleton = ({ action = true }: { action?: boolean }) => (
  <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden="true">
    <div className="flex items-start gap-3.5">
      <div className={`h-12 w-12 shrink-0 rounded-2xl ${bone}`} />
      <div className="space-y-2 pt-1">
        <div className={`h-2.5 w-20 ${bone}`} />
        <div className={`h-7 w-52 ${bone}`} />
        <div className={`h-3.5 w-80 max-w-[70vw] ${bone}`} />
      </div>
    </div>
    {action && <div className={`h-10 w-32 rounded-xl ${bone}`} />}
  </header>
);

export const SupportMetricsSkeleton = ({ compact = false }: { compact?: boolean }) => (
  <div className={`grid grid-cols-2 gap-4 ${compact ? "xl:grid-cols-4" : "xl:grid-cols-5"}`} aria-hidden="true">
    {Array.from({ length: compact ? 4 : 5 }, (_, i) => (
      <div key={i} className={`flex min-h-[112px] flex-col justify-between p-4 ${card}`}>
        <div className="flex items-center justify-between">
          <div className={`h-2.5 w-24 ${bone}`} />
          <div className={`h-8 w-8 rounded-xl ${bone}`} />
        </div>
        <div className="space-y-2">
          <div className={`h-7 w-14 ${bone}`} />
          <div className={`h-2.5 w-32 ${bone}`} />
        </div>
      </div>
    ))}
  </div>
);

export const SupportInboxSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <section className={`overflow-hidden ${card}`} aria-busy="true" aria-label="Loading tickets">
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
      <div className={`h-10 flex-1 rounded-xl ${bone}`} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`h-10 w-full rounded-xl lg:w-40 ${bone}`} />
      ))}
    </div>
    <ul className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-5 py-4">
          <div className={`mt-2 h-2.5 w-2.5 rounded-full ${bone}`} />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-8 ${bone}`} />
              <div className={`h-4 ${bone}`} style={{ width: `${44 + ((i * 17) % 30)}%` }} />
              <div className={`h-4 w-14 rounded-full ${bone}`} />
              <div className={`h-4 w-12 rounded-full ${bone}`} />
            </div>
            <div className={`h-3 w-2/5 ${bone}`} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`h-3 w-14 ${bone}`} />
            <div className={`h-3 w-20 ${bone}`} />
          </div>
        </li>
      ))}
    </ul>
  </section>
);

export const SupportThreadSkeleton = () => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true" aria-label="Loading ticket">
    <section className={`flex h-[70vh] flex-col overflow-hidden xl:h-[calc(100dvh-7.5rem)] ${card}`}>
      <div className="space-y-2 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className={`h-3.5 w-8 ${bone}`} />
          <div className={`h-5 w-72 max-w-[60%] ${bone}`} />
          <div className={`h-5 w-16 rounded-full ${bone}`} />
          <div className={`h-5 w-14 rounded-full ${bone}`} />
        </div>
        <div className={`h-3 w-64 ${bone}`} />
      </div>
      <div className="flex-1 space-y-4 bg-[#fafcfc] px-5 py-5 dark:bg-[#0b1a24]">
        {[62, 38, 70, 45, 55].map((width, i) => (
          <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
            <div className={`h-16 rounded-2xl ${bone}`} style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-slate-100 px-5 py-3">
        <div className={`h-8 w-64 rounded-xl ${bone}`} />
        <div className={`h-20 w-full rounded-xl ${bone}`} />
        <div className="flex items-center justify-between">
          <div className={`h-8 w-56 rounded-xl ${bone}`} />
          <div className={`h-9 w-28 rounded-xl ${bone}`} />
        </div>
      </div>
    </section>
    <aside className="space-y-4">
      <div className={`space-y-3 p-5 ${card}`}>
        <div className={`h-2.5 w-20 ${bone}`} />
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl ${bone}`} />
          <div className="space-y-2">
            <div className={`h-3.5 w-28 ${bone}`} />
            <div className={`h-3 w-40 ${bone}`} />
          </div>
        </div>
      </div>
      <div className={`space-y-4 p-5 ${card}`}>
        <div className={`h-2.5 w-14 ${bone}`} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className={`h-3 w-16 ${bone}`} />
            <div className={`h-10 w-full rounded-xl ${bone}`} />
          </div>
        ))}
      </div>
    </aside>
  </div>
);

export const CannedRepliesSkeleton = () => (
  <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading canned replies">
    <div className={`space-y-3 p-5 ${card}`}>
      <div className={`h-4 w-36 ${bone}`} />
      <div className={`h-10 w-full rounded-xl ${bone}`} />
      <div className={`h-32 w-full rounded-xl ${bone}`} />
      <div className={`h-9 w-28 rounded-xl ${bone}`} />
    </div>
    <div className={`divide-y divide-slate-100 ${card}`}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 px-5 py-4">
          <div className={`h-4 w-48 ${bone}`} />
          <div className={`h-3 w-full ${bone}`} />
          <div className={`h-3 w-3/4 ${bone}`} />
        </div>
      ))}
    </div>
  </div>
);
