export function StatCard({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-champagne/40 bg-white p-4 shadow-sm">
      <p className="text-sm text-cocoa-soft">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-cocoa-soft">{note}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: "NEW" | "REVIEWED" | "RESOLVED" }) {
  const styles = {
    NEW: "bg-amber-100 text-amber-900",
    REVIEWED: "bg-blue-100 text-blue-900",
    RESOLVED: "bg-green-100 text-green-900",
  } as const;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5 stars`} className="whitespace-nowrap text-gold-dark">
      <span aria-hidden="true">{"★".repeat(n)}<span className="text-cocoa/25">{"★".repeat(5 - n)}</span></span>
    </span>
  );
}

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d) + " UTC";
