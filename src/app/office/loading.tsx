/** Shown the moment an office link is clicked, while the server loads the page (the header stays). */
export default function OfficeLoading() {
  const bar = "animate-pulse rounded-md bg-line";
  return (
    <div className="flex min-h-0 flex-1" aria-busy="true" aria-label="Loading">
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-7 pt-6">
        <div className={`${bar} h-9 w-64`} />
        <div className={`${bar} h-4 w-48`} />
        <div className="flex gap-3">
          <div className={`${bar} h-12 w-40 rounded-xl`} />
          <div className={`${bar} h-12 w-40 rounded-xl`} />
        </div>
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="h-11 border-b border-line bg-surface-sunken" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-[74px] items-center gap-6 border-b border-line-soft px-6">
              <div className={`${bar} h-4 w-24`} />
              <div className={`${bar} h-6 w-28`} />
              <div className={`${bar} h-4 flex-1`} />
              <div className={`${bar} h-4 w-20`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
