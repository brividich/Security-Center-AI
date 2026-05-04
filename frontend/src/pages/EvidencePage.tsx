import { useEffect, useState } from "react";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { securityCenterApi } from "../services/api";
import type { EvidenceItem, PageKey } from "../types/securityCenter";

export function EvidencePage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [source, setSource] = useState<"api" | "error">("api");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    securityCenterApi
      .getEvidence()
      .then((result) => {
        if (!active) return;
        setItems(result);
        setSource("api");
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setSource("error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Analysis</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-950">Evidenze</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${source === "api" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {source === "api" ? "API live" : "API non disponibile"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Container audit-ready collegati ad alert, report e decision trace. I contenuti raw restano nel backend e non vengono esposti in questa vista.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate?.("alerts")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Alert
            </button>
            <button type="button" onClick={() => onNavigate?.("reports")} className="rounded-lg bg-[var(--sc-blue)] px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
              Report importati
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Caricamento evidenze...</div>
      ) : source === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Non riesco a caricare le evidenze dal backend.</div>
      ) : items.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-950">Nessuna evidenza disponibile</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Le evidenze compariranno quando parser e regole creeranno container collegati ad alert o report.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.2fr_140px_1fr_100px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase text-slate-500">
            <span>Container</span>
            <span>Stato</span>
            <span>Meta</span>
            <span className="text-right">Azioni</span>
          </div>
          {items.map((item) => (
            <div key={item.name} className="grid grid-cols-[1.2fr_140px_1fr_100px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon name="archive" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-950">{item.name}</span>
                  <span className="block text-xs text-slate-500">Evidence container</span>
                </span>
              </div>
              <SeverityBadge tone={item.status === "stored" ? "good" : "info"}>{item.status === "stored" ? "Archiviata" : "Aperta"}</SeverityBadge>
              <div className="truncate text-sm text-slate-600">{item.meta}</div>
              <div className="text-right">
                <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-500">
                  Console
                </span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
