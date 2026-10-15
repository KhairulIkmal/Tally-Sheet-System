import { demoSignIn } from "@/lib/auth/actions";

const PERSONAS = [
  { key: "worker", title: "Warehouse worker", body: "Mohd Hafiz · counts pallets, signs and submits on the phone" },
  { key: "office", title: "Office", body: "Nurul Aina · views, prints and marks sheets printed, tidies the item history" },
  { key: "both", title: "Worker + office", body: "Both roles, to try the whole flow in one browser" },
] as const;

export function DemoPicker() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-warning-bg px-3 py-2 text-sm font-semibold text-warning-ink">
        Demo mode: data is kept in memory on this computer and is lost when the dev server stops.
      </div>
      {PERSONAS.map((p) => (
        <form key={p.key} action={demoSignIn.bind(null, p.key)}>
          <button type="submit" className="w-full rounded-xl border-[1.5px] border-field bg-surface px-4 py-3 text-left hover:border-primary">
            <div className="text-[17px] font-bold">{p.title}</div>
            <div className="text-sm font-medium text-muted">{p.body}</div>
          </button>
        </form>
      ))}
    </div>
  );
}
