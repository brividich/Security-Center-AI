import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { severityLabel } from "../data/uiLabels";
import { securityCenterApi, type OverviewData } from "../services/api";
import type { PageKey, PipelineStep, ReportItem } from "../types/securityCenter";

type StatusFilter = "all" | ReportItem["status"];
type KindFilter = "all" | ReportItem["kind"];

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tutti" },
  { value: "Pending", label: "Da lavorare" },
  { value: "Failed", label: "Falliti" },
  { value: "Processed", label: "Processati" },
  { value: "Suppressed", label: "Soppressi" },
];

const kindFilters: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "Tutti i tipi" },
  { value: "mailbox", label: "Mailbox" },
  { value: "file", label: "File" },
  { value: "report", label: "Report" },
];

export function ReportsExplorerPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [source, setSource] = useState<"api" | "error">("api");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([securityCenterApi.getReports(), securityCenterApi.getOverview()])
      .then(([reportsResult, overviewResult]) => {
        setReports(reportsResult.data);
        setPipeline((overviewResult.data as OverviewData).sourcePipeline);
        setSelectedId((current) => current ?? reportsResult.data[0]?.id ?? null);
        setSource("api");
      })
      .catch(() => {
        setReports([]);
        setPipeline([]);
        setSelectedId(null);
        setSource("error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(reports.map((report) => report.source).filter(Boolean))).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesQuery = !normalizedQuery || `${report.name} ${report.source} ${report.parserName ?? ""}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      const matchesKind = kindFilter === "all" || report.kind === kindFilter;
      const matchesSource = sourceFilter === "all" || report.source === sourceFilter;
      return matchesQuery && matchesStatus && matchesKind && matchesSource;
    });
  }, [reports, query, statusFilter, kindFilter, sourceFilter]);

  useEffect(() => {
    if (!filteredReports.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredReports.some((report) => report.id === selectedId)) {
      setSelectedId(filteredReports[0].id);
    }
  }, [filteredReports, selectedId]);

  const selectedReport = filteredReports.find((report) => report.id === selectedId) ?? null;
  const stats = useMemo(() => buildStats(reports), [reports]);

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setKindFilter("all");
    setSourceFilter("all");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-950">Gestione report</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${source === "api" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {source === "api" ? "API live" : "API non disponibile"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Un unico punto per vedere cosa e' arrivato, cosa e' stato processato, cosa e' fallito e quali informazioni sono state estratte.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadData} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Aggiorna
            </button>
            <button type="button" onClick={() => onNavigate?.("inbox")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Monitor ingressi
            </button>
            <button type="button" onClick={() => onNavigate?.("configuration")} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
              Configura sorgenti
            </button>
          </div>
        </div>
      </section>

      {source === "error" && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Non riesco a caricare i report dal backend. Controlla servizio, sessione e API.
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Totale input" value={stats.total} />
        <Metric label="Processati" value={stats.processed} tone="good" />
        <Metric label="Da lavorare" value={stats.pending} tone="warning" />
        <Metric label="Falliti" value={stats.failed} tone="danger" />
        <Metric label="Metriche" value={stats.metrics} />
        <Metric label="Sorgenti" value={stats.sources} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto]">
          <label className="block text-sm font-semibold text-slate-700">
            Cerca
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Nome report, sorgente o parser"
            />
          </label>
          <Select label="Stato" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={statusFilters} />
          <Select label="Tipo" value={kindFilter} onChange={(value) => setKindFilter(value as KindFilter)} options={kindFilters} />
          <label className="block text-sm font-semibold text-slate-700">
            Sorgente
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tutte</option>
              {sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={resetFilters} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">Coda report e input</h2>
              <p className="text-sm text-slate-500">{filteredReports.length} elementi visibili su {reports.length}</p>
            </div>
            <button type="button" onClick={() => openConfigurationTab("test")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Test parser
            </button>
          </div>
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Caricamento report...</div>
          ) : filteredReports.length ? (
            <div className="space-y-2">
              {filteredReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  className={`w-full rounded-lg border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 ${
                    selectedReport?.id === report.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <KindPill kind={report.kind} />
                        <StatusBadge status={report.status} />
                      </div>
                      <div className="mt-2 font-bold text-slate-950">{report.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{report.source} - {report.receivedAt}</div>
                    </div>
                    <div className="text-right text-xs font-semibold text-slate-500">
                      <div>{report.metrics} metriche</div>
                      <div>{report.alerts} alert</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
              <h3 className="font-bold text-slate-950">Nessun report con questi filtri</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Cambia filtri o verifica Monitor ingressi e configurazione sorgenti.</p>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">Dettaglio selezionato</h2>
              <Icon name="file" className="h-5 w-5 text-slate-500" />
            </div>
            {selectedReport ? (
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <KindPill kind={selectedReport.kind} />
                    <StatusBadge status={selectedReport.status} />
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-950">{selectedReport.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedReport.detail ?? "Informazione normalizzata dal backend."}</p>
                </div>
                <DetailGrid report={selectedReport} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => openConfigurationTab("test")} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
                    Test parser
                  </button>
                  <button type="button" onClick={() => onNavigate?.("configuration")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Configura sorgenti
                  </button>
                  <button type="button" onClick={() => onNavigate?.("inbox")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:col-span-2">
                    Vedi monitor ingressi
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Seleziona un report per vedere stato, sorgente e informazioni estratte.
              </div>
            )}
          </section>

          <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm">
            <h2 className="font-bold">Pipeline collegata</h2>
            <p className="mt-1 text-sm text-slate-400">Conteggi backend per capire dove si fermano gli input.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pipeline.length ? pipeline.map((step) => (
                <div key={step.name} className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
                  <div className="text-2xl font-bold">{step.value}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{step.name}</div>
                  <div className="text-xs text-slate-400">{step.detail}</div>
                </div>
              )) : (
                <div className="rounded-lg bg-white/10 p-4 text-sm text-slate-300 ring-1 ring-white/10 sm:col-span-2">Nessun dato pipeline disponibile.</div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function buildStats(reports: ReportItem[]) {
  return {
    total: reports.length,
    processed: reports.filter((report) => report.status === "Processed").length,
    pending: reports.filter((report) => report.status === "Pending").length,
    failed: reports.filter((report) => report.status === "Failed").length,
    metrics: reports.reduce((total, report) => total + report.metrics, 0),
    sources: new Set(reports.map((report) => report.source)).size,
  };
}

function openConfigurationTab(tab: string) {
  window.history.pushState(null, "", `/configuration?tab=${tab}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "warning" | "danger" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function KindPill({ kind }: { kind: ReportItem["kind"] }) {
  const label = kind === "mailbox" ? "Mailbox" : kind === "file" ? "File" : "Report";
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{label}</span>;
}

function StatusBadge({ status }: { status: ReportItem["status"] }) {
  const tone = status === "Processed" ? "good" : status === "Failed" ? "danger" : status === "Pending" ? "warning" : "info";
  return <SeverityBadge tone={tone}>{severityLabel(status)}</SeverityBadge>;
}

function DetailGrid({ report }: { report: ReportItem }) {
  const rows = [
    ["Sorgente", report.source],
    ["Ricevuto", report.receivedAt],
    ["Parser", report.parserName ?? "N/D"],
    ["Metriche", String(report.metrics)],
    ["Alert", String(report.alerts)],
    ["ID", report.id],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-bold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
