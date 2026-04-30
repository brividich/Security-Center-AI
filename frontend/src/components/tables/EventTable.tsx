import { useEffect, useState } from "react";
import type { InboxItem, Severity } from "../../types/securityCenter";
import { severityLabel } from "../../data/uiLabels";
import { Icon } from "../common/Icon";
import { SeverityBadge, toneForSeverity } from "../common/SeverityBadge";

interface EventTableProps {
  items: InboxItem[];
  compact?: boolean;
}

function SeverityDot({ severity }: { severity: Severity }) {
  const cls = severity === "critical" ? "bg-red-500" : severity === "high" ? "bg-amber-500" : severity === "medium" ? "bg-blue-500" : "bg-slate-400";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

export function EventTable({ items, compact = false }: EventTableProps) {
  const [selected, setSelected] = useState<InboxItem | null>(items[0] ?? null);

  useEffect(() => {
    setSelected((current) => {
      if (current && items.some((item) => item.id === current.id)) {
        return current;
      }
      return items[0] ?? null;
    });
  }, [items]);

  return (
    <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:grid-cols-[1fr_0.9fr]">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">Inbox eventi</h2>
            <p className="text-sm text-slate-500">Lista normalizzata, gia deduplicata e ordinata per priorita.</p>
          </div>
          {!compact ? <SeverityBadge tone="dark">{`${items.length} aperti`}</SeverityBadge> : null}
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Nessun evento disponibile.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:bg-slate-50 ${
                  selected?.id === item.id ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <SeverityDot severity={item.severity} />
                      {item.type}
                    </div>
                    <div className="mt-1 truncate font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.source} - {item.time}
                    </div>
                  </div>
                  <Icon name="chevron" className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <aside className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
        {selected ? (
          <>
            <SeverityBadge tone={toneForSeverity(selected.severity)}>{severityLabel(selected.severity)}</SeverityBadge>
            <h3 className="mt-3 text-lg font-bold text-slate-950">{selected.title}</h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-500">Perche e stato creato</dt>
                <dd className="mt-1 text-slate-800">{selected.why}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Azione suggerita</dt>
                <dd className="mt-1 text-slate-800">{selected.recommendation}</dd>
              </div>
            </dl>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Apri caso</button>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Snooze</button>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-500">Seleziona un evento per vedere il dettaglio operativo.</div>
        )}
      </aside>
    </section>
  );
}
