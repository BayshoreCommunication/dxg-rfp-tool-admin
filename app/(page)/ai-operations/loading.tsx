export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-10 w-72 animate-pulse rounded bg-slate-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />)}
      </div>
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
    </main>
  );
}
