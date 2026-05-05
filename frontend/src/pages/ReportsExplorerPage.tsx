import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { AIAssistButton } from "../components/ai/AIAssistButton";
import { severityLabel } from "../data/uiLabels";
import { securityCenterApi, type OverviewData } from "../services/api";
import type { PageKey, PipelineStep, ReportItem } from "../types/securityCenter";
import { navigateToClientPath } from "../utils/clientNavigation";

type StatusFilter = "all" | ReportItem["status"];
type KindFilter = "all" | ReportItem["kind"];
type GroupMode = "none" | "source" | "parser" | "reportType" | "status";

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

const groupModes: Array<{ value: GroupMode; label: string }> = [
  { value: "none", label: "Nessun gruppo" },
  { value: "source", label: "Sorgente" },
  { value: "parser", label: "Parser" },
  { value: "reportType", label: "Tipo report" },
  { value: "status", label: "Stato" },
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
  const [groupMode, setGroupMode] = useState<GroupMode>("source");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: "good" | "warning" | "danger"; message: string } | null>(null);

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

  useEffect(() => {
    setActionNotice(null);
  }, [selectedId]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(reports.map((report) => report.source).filter(Boolean))).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reports.filter((report) => {
      const searchText = `${report.name} ${report.source} ${report.parserName ?? ""} ${report.reportType ?? ""} ${report.detail ?? ""} ${report.dedupStatus?.label ?? ""}`;
      const matchesQuery = !normalizedQuery || searchText.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      const matchesKind = kindFilter === "all" || report.kind === kindFilter;
      const matchesSource = sourceFilter === "all" || report.source === sourceFilter;
      return matchesQuery && matchesStatus && matchesKind && matchesSource;
    });
  }, [reports, query, statusFilter, kindFilter, sourceFilter]);

  const groupedReports = useMemo(() => groupReports(filteredReports, groupMode), [filteredReports, groupMode]);

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
  const retryableReports = useMemo(() => filteredReports.filter(canRetryReportItem).slice(0, 25), [filteredReports]);

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setKindFilter("all");
    setSourceFilter("all");
    setGroupMode("source");
  };

  const retrySelectedReport = () => {
    if (!selectedReport || actionBusyId) {
      return;
    }
    setActionBusyId(selectedReport.id);
    setActionNotice(null);
    securityCenterApi.retryReportItem(selectedReport.id)
      .then((result) => {
        const data = result.data;
        setActionNotice({
          tone: data.errors > 0 ? "warning" : data.status === "success" ? "good" : "warning",
          message: `${data.message} Report: ${data.reportsParsed}, eventi: ${data.events}, alert: ${data.alerts}.`,
        });
        loadData();
      })
      .catch((error) => {
        setActionNotice({
          tone: "danger",
          message: error instanceof Error ? error.message : "Azione non riuscita.",
        });
      })
      .finally(() => setActionBusyId(null));
  };

  const retryVisibleReports = () => {
    if (!retryableReports.length || actionBusyId) {
      return;
    }
    setActionBusyId("bulk");
    setActionNotice(null);
    securityCenterApi.retryReportItems(retryableReports.map((report) => report.id))
      .then((result) => {
        const data = result.data;
        setActionNotice({
          tone: data.failed > 0 ? "warning" : "good",
          message: `Retry bulk completato. Processati: ${data.processed}/${data.total}, report: ${data.reportsParsed}, eventi: ${data.events}, alert: ${data.alerts}.`,
        });
        loadData();
      })
      .catch((error) => {
        setActionNotice({
          tone: "danger",
          message: error instanceof Error ? error.message : "Azione bulk non riuscita.",
        });
      })
      .finally(() => setActionBusyId(null));
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
        <Metric label="Alert" value={stats.alerts} tone={stats.alerts ? "warning" : "neutral"} />
        <Metric label="Casi/Ticket" value={stats.tickets} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.75fr_0.75fr_0.75fr_0.75fr_auto]">
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
          <Select label="Raggruppa" value={groupMode} onChange={(value) => setGroupMode(value as GroupMode)} options={groupModes} />
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

      {actionNotice && <ActionNotice tone={actionNotice.tone} message={actionNotice.message} />}

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
            <button
              type="button"
              onClick={retryVisibleReports}
              disabled={!retryableReports.length || actionBusyId === "bulk"}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionBusyId === "bulk" ? "Retry bulk..." : `Riprova visibili (${retryableReports.length})`}
            </button>
          </div>
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Caricamento report...</div>
          ) : filteredReports.length ? (
            <div className="space-y-2">
              {groupedReports.map((group) => (
                <div key={group.key} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {groupMode !== "none" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
                      <div>
                        <div className="text-sm font-bold text-slate-950">{group.label}</div>
                        <div className="text-xs text-slate-500">{group.items.length} elementi - {group.events} eventi - {group.alerts} alert</div>
                      </div>
                      {group.tickets > 0 && <SeverityBadge tone="warning">{`${group.tickets} casi/ticket`}</SeverityBadge>}
                    </div>
                  )}
                  <div className="space-y-2">
                    {group.items.map((report) => (
                      <ReportRow
                        key={report.id}
                        report={report}
                        selected={selectedReport?.id === report.id}
                        onSelect={() => setSelectedId(report.id)}
                      />
                    ))}
                  </div>
                </div>
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
                <DedupStatus report={selectedReport} />
                <ReportTimeline report={selectedReport} />
                <MetricPreview report={selectedReport} />
                <OperationalSummary report={selectedReport} />
                <LinkedOperations report={selectedReport} />
                <TuningActions report={selectedReport} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {canRetryReportItem(selectedReport) && (
                    <button
                      type="button"
                      onClick={retrySelectedReport}
                      disabled={actionBusyId === selectedReport.id}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionBusyId === selectedReport.id ? "Processamento..." : "Riprova processamento"}
                    </button>
                  )}
                  <button type="button" onClick={() => openConfigurationTab("test")} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
                    Test parser
                  </button>
                  <button type="button" onClick={() => onNavigate?.("configuration")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Configura sorgenti
                  </button>
                  <button type="button" onClick={() => onNavigate?.("inbox")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:col-span-2">
                    Vedi monitor ingressi
                  </button>
                  <AIAssistButton page="report" objectType="report" objectId={selectedReport.id} label="Analizza con AI" />
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
    events: reports.reduce((total, report) => total + report.events, 0),
    alerts: reports.reduce((total, report) => total + report.alerts, 0),
    evidence: reports.reduce((total, report) => total + report.evidence, 0),
    tickets: reports.reduce((total, report) => total + report.tickets, 0),
    warnings: reports.reduce((total, report) => total + report.warnings, 0),
    sources: new Set(reports.map((report) => report.source)).size,
  };
}

function groupReports(reports: ReportItem[], groupMode: GroupMode) {
  if (groupMode === "none") {
    return [buildReportGroup("all", "Tutti gli elementi", reports)];
  }
  const groups = new Map<string, ReportItem[]>();
  for (const report of reports) {
    const key = groupKey(report, groupMode);
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  return Array.from(groups.entries())
    .map(([key, items]) => buildReportGroup(key, key, items))
    .sort((left, right) => right.alerts - left.alerts || right.tickets - left.tickets || left.label.localeCompare(right.label));
}

function buildReportGroup(key: string, label: string, items: ReportItem[]) {
  return {
    key,
    label,
    items,
    events: items.reduce((total, report) => total + report.events, 0),
    alerts: items.reduce((total, report) => total + report.alerts, 0),
    tickets: items.reduce((total, report) => total + report.tickets, 0),
  };
}

function groupKey(report: ReportItem, groupMode: GroupMode) {
  if (groupMode === "source") return report.source || "Sorgente sconosciuta";
  if (groupMode === "parser") return report.parserName || "Parser non rilevato";
  if (groupMode === "reportType") return formatReportType(report.reportType) || inputKindLabel(report.kind);
  if (groupMode === "status") return severityLabel(report.status);
  return "Tutti gli elementi";
}

function formatReportType(value?: string) {
  if (!value) return "";
  return value.replace(/_/g, " ");
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

function canRetryReportItem(report: ReportItem) {
  return report.status === "Pending" || report.status === "Failed" || report.status === "Suppressed";
}

function ActionNotice({ tone, message }: { tone: "good" | "warning" | "danger"; message: string }) {
  const toneClass = tone === "good"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";
  return <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${toneClass}`}>{message}</div>;
}

function KindPill({ kind }: { kind: ReportItem["kind"] }) {
  const label = kind === "mailbox" ? "Mailbox" : kind === "file" ? "File" : "Report";
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{label}</span>;
}

function StatusBadge({ status }: { status: ReportItem["status"] }) {
  const tone = status === "Processed" ? "good" : status === "Failed" ? "danger" : status === "Pending" ? "warning" : "info";
  return <SeverityBadge tone={tone}>{severityLabel(status)}</SeverityBadge>;
}

function ReportRow({ report, selected, onSelect }: { report: ReportItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 ${
        selected ? "border-blue-300 bg-blue-50" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KindPill kind={report.kind} />
            <StatusBadge status={report.status} />
            {report.dedupStatus?.state === "tracked" && <SeverityBadge tone="good">Dedup OK</SeverityBadge>}
            {report.dedupStatus?.state === "missing" && <SeverityBadge tone="warning">Dedup da verificare</SeverityBadge>}
          </div>
          <div className="mt-2 font-bold text-slate-950">{report.name}</div>
          <div className="mt-1 text-sm text-slate-500">{report.source} - {report.receivedAt}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {report.parserName ?? "N/D"}{report.reportType ? ` - ${formatReportType(report.reportType)}` : ""}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs font-semibold text-slate-500">
          <div>{report.metrics} metriche</div>
          <div>{report.events} eventi</div>
          <div>{report.alerts} alert</div>
          <div>{report.tickets} casi</div>
          {report.warnings > 0 && <div className="col-span-2 text-amber-700">{report.warnings} avvisi</div>}
        </div>
      </div>
    </button>
  );
}

function DetailGrid({ report }: { report: ReportItem }) {
  const rows = [
    ["Sorgente", report.source],
    ["Ricevuto", report.receivedAt],
    ["Parser", report.parserName ?? "N/D"],
    ["Tipo report", formatReportType(report.reportType) || "N/D"],
    ["Data report", report.reportDate ?? "N/D"],
    ["Input", inputKindLabel(report.inputKind ?? report.kind)],
    ["Metriche", String(report.metrics)],
    ["Eventi", String(report.events)],
    ["Alert", String(report.alerts)],
    ["Evidenze", String(report.evidence)],
    ["Casi/Ticket", String(report.tickets)],
    ["Avvisi", String(report.warnings)],
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

function DedupStatus({ report }: { report: ReportItem }) {
  const dedup = report.dedupStatus;
  if (!dedup) {
    return null;
  }
  const tone = dedup.state === "tracked" ? "good" : dedup.state === "missing" ? "warning" : "neutral";
  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-950">Deduplica e reimport</h3>
          <p className="mt-1 text-sm text-slate-500">{dedup.detail}</p>
        </div>
        <SeverityBadge tone={tone}>{dedup.label}</SeverityBadge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SummaryRow label="Duplicati rilevati" value={dedup.duplicates} meta="Stessa chiave parser" />
        <SummaryRow label="Input collegato" value={dedup.inputLinked ? 1 : 0} meta={dedup.inputLinked ? "Tracciabile" : "Manuale o storico"} />
      </div>
    </div>
  );
}

function ReportTimeline({ report }: { report: ReportItem }) {
  const timeline = report.timeline ?? [];
  if (!timeline.length) {
    return null;
  }
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-slate-950">Timeline operativa</h3>
      <div className="mt-3 space-y-2">
        {timeline.map((item, index) => (
          <div key={`${item.kind}-${index}`} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.status === "attention" ? "bg-amber-500" : item.status === "done" ? "bg-emerald-500" : "bg-slate-400"}`} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{item.label}</div>
              <div className="text-xs text-slate-500">{item.detail}{item.at ? ` - ${formatTimelineDate(item.at)}` : ""}</div>
            </div>
            <div className="text-sm font-bold text-slate-950">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricPreview({ report }: { report: ReportItem }) {
  const metrics = report.metricPreview ?? [];
  if (!metrics.length) {
    return null;
  }
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-slate-950">Metriche estratte</h3>
      <div className="mt-3 space-y-2">
        {metrics.map((metric) => (
          <div key={metric.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-semibold text-slate-700">{formatReportType(metric.name)}</span>
            <span className="shrink-0 font-bold text-slate-950">{formatMetricValue(metric.value, metric.unit)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TuningActions({ report }: { report: ReportItem }) {
  const actions = report.tuningActions ?? [];
  if (!actions.length) {
    return null;
  }
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-slate-950">Tuning dal report</h3>
      <div className="mt-3 grid gap-2">
        {actions.map((action) => (
          <button
            key={`${action.kind}-${action.target}`}
            type="button"
            onClick={() => openInternalPath(action.target)}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block truncate">{action.label}</span>
              <span className="block truncate text-xs font-semibold text-slate-500">{action.detail || "Configurazione"}</span>
            </span>
            <Icon name="chevron" className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

function OperationalSummary({ report }: { report: ReportItem }) {
  const events = report.eventSummary ?? [];
  const alerts = report.alertSummary ?? [];
  if (!events.length && !alerts.length && report.warnings === 0) {
    return null;
  }
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-slate-950">Impatto operativo</h3>
      <div className="mt-3 grid gap-2">
        {events.map((event) => (
          <SummaryRow key={`${event.eventType}-${event.severity}`} label={formatReportType(event.eventType)} value={event.total} meta={severityLabel(event.severity)} />
        ))}
        {alerts.map((alert) => (
          <SummaryRow key={`${alert.status}-${alert.severity}`} label={`Alert ${severityLabel(alert.status)}`} value={alert.total} meta={severityLabel(alert.severity)} />
        ))}
        {report.evidence > 0 && <SummaryRow label="Evidence Container" value={report.evidence} meta="Audit trail disponibile" />}
        {report.tickets > 0 && <SummaryRow label="Casi/Ticket" value={report.tickets} meta="Remediation workflow" />}
        {report.warnings > 0 && <SummaryRow label="Avvisi parser" value={report.warnings} meta="Da verificare" />}
      </div>
    </div>
  );
}

function LinkedOperations({ report }: { report: ReportItem }) {
  const alerts = report.alertPreview ?? [];
  const tickets = report.ticketPreview ?? [];
  const evidence = report.evidencePreview ?? [];
  if (!alerts.length && !tickets.length && !evidence.length) {
    return null;
  }
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-slate-950">Oggetti collegati</h3>
      <div className="mt-3 space-y-3">
        {alerts.length > 0 && (
          <LinkedList
            title="Alert"
            items={alerts.map((alert) => ({
              key: `alert-${alert.id}`,
              title: alert.title,
              meta: `${severityLabel(alert.severity)} - ${severityLabel(alert.status)}`,
              count: formatLinkedDate(alert.updatedAt ?? alert.createdAt),
              target: `/alerts/${alert.id}`,
            }))}
          />
        )}
        {tickets.length > 0 && (
          <LinkedList
            title="Casi/Ticket"
            items={tickets.map((ticket) => ({
              key: `ticket-${ticket.id}`,
              title: ticket.title,
              meta: `${severityLabel(ticket.severity)} - ${severityLabel(ticket.status)}`,
              count: `${ticket.occurrenceCount} occ.`,
            }))}
          />
        )}
        {evidence.length > 0 && (
          <LinkedList
            title="Evidenze"
            items={evidence.map((item) => ({
              key: `evidence-${item.id}`,
              title: item.title,
              meta: severityLabel(item.status),
              count: `${item.itemsCount} item`,
            }))}
          />
        )}
      </div>
    </div>
  );
}

function LinkedList({ title, items }: { title: string; items: Array<{ key: string; title: string; meta: string; count: string; target?: string }> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-bold uppercase text-slate-500">{title}</div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const content = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">{item.title}</span>
                <span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">
                {item.count}
                {item.target && <Icon name="chevron" className="h-4 w-4 text-slate-400" />}
              </span>
            </>
          );
          if (item.target) {
            return (
              <button key={item.key} type="button" onClick={() => openInternalPath(item.target as string)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50">
                {content}
              </button>
            );
          }
          return (
            <div key={item.key} className="flex items-center justify-between gap-3 px-3 py-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, meta }: { label: string; value: number; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">{meta}</div>
      </div>
      <div className="shrink-0 text-lg font-bold text-slate-950">{value}</div>
    </div>
  );
}

function inputKindLabel(kind: string) {
  if (kind === "mailbox") return "Mailbox";
  if (kind === "file") return "File";
  if (kind === "manual") return "Manuale";
  return kind;
}

function openInternalPath(path: string) {
  navigateToClientPath(path);
}

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatLinkedDate(value?: string | null) {
  if (!value) {
    return "--";
  }
  return formatTimelineDate(value);
}

function formatMetricValue(value: number, unit?: string) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}
