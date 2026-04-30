import { useEffect, useState } from "react";
import { EventTable } from "../components/tables/EventTable";
import { ReportsTable } from "../components/tables/ReportsTable";
import { securityCenterApi } from "../services/api";
import type { InboxItem, PageKey, PipelineStep, ReportItem } from "../types/securityCenter";

export function EventInboxPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [source, setSource] = useState<"api" | "error">("api");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([securityCenterApi.getEvents(), securityCenterApi.getReports(), securityCenterApi.getOverview()])
      .then(([eventsResult, reportsResult, overviewResult]) => {
        if (!active) return;
        setItems(eventsResult.data);
        setReports(reportsResult.data);
        setPipeline(overviewResult.data.sourcePipeline);
        setSource("api");
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setReports([]);
        setPipeline([]);
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
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-950">Monitor ingressi</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${source === "api" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {source === "api" ? "API live" : "API non disponibile"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Questa e' la vista per capire cosa sta entrando: alert recenti, report normalizzati e salute della pipeline.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate?.("reports")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Apri report
            </button>
            <button type="button" onClick={() => onNavigate?.("configuration")} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
              Configura sorgenti
            </button>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Caricamento ingressi...</div>
      ) : source === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Non riesco a caricare gli ingressi dal backend.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Alert recenti" value={items.length} />
            <Metric label="Report/input" value={reports.length} />
            <Metric label="Step pipeline" value={pipeline.length} />
            <Metric label="Errori input" value={pipeline.find((step) => step.name.toLowerCase() === "errori")?.value ?? 0} />
          </div>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Pipeline di ingestione</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {pipeline.length ? pipeline.map((step) => (
                <div key={step.name} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-2xl font-bold text-slate-950">{step.value}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">{step.name}</div>
                  <div className="text-xs text-slate-500">{step.detail}</div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-3">
                  Nessun dato pipeline disponibile.
                </div>
              )}
            </div>
          </section>
          <EventTable items={items} />
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">Report e input recenti</h2>
              <button type="button" onClick={() => onNavigate?.("reports")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Vista completa report
              </button>
            </div>
            <ReportsTable reports={reports.slice(0, 8)} />
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}
