import type { DayKpi, EvidenceItem, IconName, InboxItem, ModuleStatus, PipelineStep, ReportActionResult, ReportBulkActionResult, ReportItem, RuleItem, Severity, TimelineItem } from "../types/securityCenter";
import { apiClient } from "./apiClient";
import { API_BASE_URL } from "./config";

type DataSource = "api";

interface ApiEnvelope<T> {
  data: T;
  source: DataSource;
  error?: string;
}

interface DashboardSummaryResponse {
  generated_at: string;
  open_alerts_count: number;
  critical_alerts_count: number;
  open_tickets_count: number;
  evidence_containers_count: number;
  recent_alerts: RecentAlertResponse[];
  kpi_summary?: KpiSummaryResponse;
  ingestion_status?: IngestionStatusResponse;
}

interface RecentAlertResponse {
  id: number;
  title: string;
  severity: string;
  status: string;
  source_name?: string;
  source?: string;
  created_at: string | null;
  updated_at: string | null;
  detail_url: string;
}

interface KpiSummaryResponse {
  generated_at: string;
  counters: Record<string, number>;
  trends: Array<{ date: string; total: number }>;
  period_label: string;
  empty_state: boolean;
}

interface IngestionStatusResponse {
  reports_total: number;
  events_total: number;
  mailbox_messages: Record<string, number>;
  source_files: Record<string, number>;
}

interface AddonsSummaryResponse {
  generated_at: string;
  modules: AddonSummaryResponse[];
}

interface AddonSummaryResponse {
  code: string;
  name: string;
  status: string;
  enabled?: boolean;
  configured?: boolean;
  parser_count: number;
  source_count: number;
  alert_rule_count: number;
  warning_count: number;
  detail_url: string;
}

interface RecentAlertsResponse {
  generated_at: string;
  alerts: RecentAlertResponse[];
}

interface InboxRecentResponse {
  generated_at: string;
  recent_reports: Array<{
    id: number;
    title: string;
    source_name: string;
    source_type?: string;
    vendor?: string;
    report_type?: string;
    report_date?: string | null;
    parser_name: string;
    parse_status: string;
    created_at: string | null;
    input_kind?: string;
    metrics_count?: number;
    events_count?: number;
    alerts_count?: number;
    evidence_count?: number;
    tickets_count?: number;
    warnings_count?: number;
    dedup_status?: {
      state?: string;
      label?: string;
      detail?: string;
      duplicates?: number;
      input_linked?: boolean;
    };
    timeline?: Array<{ kind: string; label: string; status: string; at?: string | null; detail: string; count: number }>;
    tuning_actions?: Array<{ kind: string; label: string; target: string; detail: string }>;
    metric_preview?: Array<{ name: string; value: number; unit?: string }>;
    event_summary?: Array<{ event_type: string; severity: string; total: number }>;
    alert_summary?: Array<{ status: string; severity: string; total: number }>;
    alert_preview?: Array<{
      id: number;
      title: string;
      severity: string;
      status: string;
      source_name: string;
      created_at?: string | null;
      updated_at?: string | null;
      detail_url: string;
    }>;
    ticket_preview?: Array<{
      id: number;
      title: string;
      severity: string;
      status: string;
      source_name: string;
      occurrence_count: number;
      updated_at?: string | null;
      detail_url: string;
    }>;
    evidence_preview?: Array<{
      id: string;
      title: string;
      status: string;
      source_name: string;
      items_count: number;
      created_at?: string | null;
    }>;
  }>;
  recent_mailbox_messages: Array<{
    id: number;
    subject: string;
    source_name: string;
    source_type?: string;
    parse_status: string;
    received_at: string | null;
    parser_name?: string;
    linked_report_ids?: number[];
    reports_count?: number;
    metrics_count?: number;
    events_count?: number;
    alerts_count?: number;
    evidence_count?: number;
    tickets_count?: number;
    warnings_count?: number;
    errors_count?: number;
    pipeline_status?: string;
  }>;
  recent_source_files: Array<{
    id: number;
    original_name: string;
    source_name: string;
    source_type?: string;
    file_type: string;
    parse_status: string;
    uploaded_at: string | null;
    parser_name?: string;
    linked_report_ids?: number[];
    reports_count?: number;
    metrics_count?: number;
    events_count?: number;
    alerts_count?: number;
    evidence_count?: number;
    tickets_count?: number;
    warnings_count?: number;
  }>;
  latest_pipeline_status?: IngestionStatusResponse;
}

interface InboxRetryResponse {
  item_kind: string;
  id: number;
  source_report_id?: number | null;
  previous_status: string;
  parse_status: string;
  status: string;
  processed: boolean;
  parser_detected: boolean;
  parser_name: string;
  reports_parsed: number;
  metrics_count: number;
  events_count: number;
  alerts_count: number;
  evidence_count: number;
  tickets_count: number;
  warnings_count: number;
  errors_count: number;
  message: string;
}

interface InboxBulkRetryResponse {
  summary: {
    total: number;
    processed: number;
    success: number;
    skipped: number;
    failed: number;
    reports_parsed: number;
    events: number;
    alerts: number;
  };
  results: InboxRetryResponse[];
}

export interface OverviewData {
  modules: ModuleStatus[];
  days: DayKpi[];
  kpiCounters: Array<{ name: string; value: number }>;
  kpiPeriodLabel: string;
  sourcePipeline: PipelineStep[];
  timeline: TimelineItem[];
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  inboxItems: InboxItem[];
}

async function loadEvents(): Promise<InboxItem[]> {
  const response = await apiClient.get<RecentAlertsResponse>("/security/api/alerts/recent/?limit=50");
  return response.alerts.map((alert) => ({
    id: String(alert.id),
    type: alert.status,
    title: alert.title,
    source: alert.source_name ?? alert.source ?? "Security Center",
    time: formatTime(alert.updated_at ?? alert.created_at),
    severity: normalizeSeverity(alert.severity),
    why: "Alert generato dal backend Security Center AI.",
    recommendation: "Usare la console per triage, evidenze e lifecycle.",
  }));
}

async function loadReports(): Promise<ReportItem[]> {
  const response = await apiClient.get<InboxRecentResponse>("/security/api/inbox/recent/?limit=50");
  const reportsFromParser = response.recent_reports.map((report) => ({
    id: `report-${report.id}`,
    kind: "report" as const,
    name: report.title,
    source: report.source_name,
    status: mapParseStatus(report.parse_status),
    metrics: report.metrics_count ?? 0,
    events: report.events_count ?? 0,
    alerts: report.alerts_count ?? 0,
    evidence: report.evidence_count ?? 0,
    tickets: report.tickets_count ?? 0,
    warnings: report.warnings_count ?? 0,
    receivedAt: formatDateTime(report.created_at),
    parserName: report.parser_name || "N/D",
    reportType: report.report_type,
    reportDate: formatDate(report.report_date),
    sourceType: report.source_type,
    inputKind: report.input_kind,
    dedupStatus: mapDedupStatus(report.dedup_status),
    timeline: report.timeline?.map(mapTimelineItem),
    tuningActions: report.tuning_actions?.map((action) => ({ kind: action.kind, label: action.label, target: action.target, detail: action.detail })),
    metricPreview: report.metric_preview?.map((metric) => ({ name: metric.name, value: metric.value, unit: metric.unit })),
    eventSummary: report.event_summary?.map((event) => ({ eventType: event.event_type, severity: event.severity, total: event.total })),
    alertSummary: report.alert_summary?.map((alert) => ({ status: alert.status, severity: alert.severity, total: alert.total })),
    alertPreview: report.alert_preview?.map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
      sourceName: alert.source_name,
      createdAt: alert.created_at,
      updatedAt: alert.updated_at,
      detailUrl: alert.detail_url,
    })),
    ticketPreview: report.ticket_preview?.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      severity: ticket.severity,
      status: ticket.status,
      sourceName: ticket.source_name,
      occurrenceCount: ticket.occurrence_count,
      updatedAt: ticket.updated_at,
      detailUrl: ticket.detail_url,
    })),
    evidencePreview: report.evidence_preview?.map((evidence) => ({
      id: evidence.id,
      title: evidence.title,
      status: evidence.status,
      sourceName: evidence.source_name,
      itemsCount: evidence.items_count,
      createdAt: evidence.created_at,
    })),
    detail: buildReportDetail(report.report_type, report.input_kind),
  }));
  const sourceFiles = response.recent_source_files.map((file) => ({
    id: `file-${file.id}`,
    kind: "file" as const,
    name: file.original_name,
    source: file.source_name,
    status: mapParseStatus(file.parse_status),
    metrics: file.metrics_count ?? 0,
    events: file.events_count ?? 0,
    alerts: file.alerts_count ?? 0,
    evidence: file.evidence_count ?? 0,
    tickets: file.tickets_count ?? 0,
    warnings: file.warnings_count ?? 0,
    receivedAt: formatDateTime(file.uploaded_at),
    parserName: file.parser_name || "N/D",
    reportType: file.file_type,
    sourceType: file.source_type,
    linkedReportIds: file.linked_report_ids ?? [],
    detail: `${file.reports_count ?? 0} report collegati da file ${file.file_type || "upload"}`,
  }));
  const mailboxMessages = response.recent_mailbox_messages.map((message) => ({
    id: `mail-${message.id}`,
    kind: "mailbox" as const,
    name: message.subject || "Messaggio mailbox",
    source: message.source_name,
    status: mapParseStatus(message.parse_status),
    metrics: message.metrics_count ?? 0,
    events: message.events_count ?? 0,
    alerts: message.alerts_count ?? 0,
    evidence: message.evidence_count ?? 0,
    tickets: message.tickets_count ?? 0,
    warnings: (message.warnings_count ?? 0) + (message.errors_count ?? 0),
    receivedAt: formatDateTime(message.received_at),
    parserName: message.parser_name || "N/D",
    sourceType: message.source_type,
    linkedReportIds: message.linked_report_ids ?? [],
    detail: `${message.reports_count ?? 0} report collegati da mailbox${message.pipeline_status ? ` - pipeline ${message.pipeline_status}` : ""}`,
  }));
  return [...reportsFromParser, ...sourceFiles, ...mailboxMessages].slice(0, 50);
}

async function loadOverview(): Promise<OverviewData> {
  const [dashboard, addons] = await Promise.all([
    apiClient.get<DashboardSummaryResponse>("/security/api/dashboard-summary/"),
    apiClient.get<AddonsSummaryResponse>("/security/api/addons/summary/"),
  ]);
  return {
    modules: buildModules(addons.modules, dashboard),
    days: buildDays(dashboard),
    kpiCounters: buildKpiCounters(dashboard),
    kpiPeriodLabel: dashboard.kpi_summary?.period_label ?? "Periodo corrente",
    sourcePipeline: buildPipeline(dashboard),
    timeline: buildTimeline(dashboard.recent_alerts),
    severityDistribution: buildSeverityDistribution(dashboard),
    inboxItems: buildInboxItems(dashboard.recent_alerts),
  };
}

function buildModules(apiModules: AddonSummaryResponse[], dashboard: DashboardSummaryResponse): ModuleStatus[] {
  if (!apiModules.length) {
    return [];
  }
  const cards = apiModules.slice(0, 4).map((module) => ({
    key: module.code,
    title: module.name,
    score: moduleScore(module.status),
    subtitle: `${module.source_count} sorgenti - ${module.warning_count} avvisi`,
    tone: moduleTone(module.status),
    icon: moduleIcon(module.code),
  }));
  if (cards.length < 4) {
    cards.push({
      key: "security",
      title: "Sicurezza",
      score: dashboard.critical_alerts_count > 0 ? 72 : 92,
      subtitle: `${dashboard.open_alerts_count} alert aperti - ${dashboard.open_tickets_count} ticket`,
      tone: dashboard.critical_alerts_count > 0 ? "danger" : dashboard.open_alerts_count > 0 ? "warning" : "good",
      icon: "shield",
    });
  }
  return cards;
}

function buildPipeline(dashboard: DashboardSummaryResponse): PipelineStep[] {
  const ingestion = dashboard.ingestion_status;
  if (!ingestion) {
    return [];
  }
  const pendingMailbox = ingestion.mailbox_messages.pending ?? 0;
  const pendingFiles = ingestion.source_files.pending ?? 0;
  const failedMailbox = ingestion.mailbox_messages.failed ?? 0;
  const failedFiles = ingestion.source_files.failed ?? 0;
  return [
    { name: "Mailbox", value: pendingMailbox + (ingestion.mailbox_messages.parsed ?? 0), detail: "messaggi tracciati" },
    { name: "File", value: pendingFiles + (ingestion.source_files.parsed ?? 0), detail: "upload tracciati" },
    { name: "Report", value: ingestion.reports_total, detail: "report normalizzati" },
    { name: "Eventi", value: ingestion.events_total, detail: "eventi strutturati" },
    { name: "Alert", value: dashboard.open_alerts_count, detail: "alert aperti" },
    { name: "Errori", value: failedMailbox + failedFiles, detail: "input falliti" },
  ];
}

function buildTimeline(alerts: RecentAlertResponse[]): TimelineItem[] {
  if (!alerts.length) {
    return [];
  }
  return alerts.slice(0, 5).map((alert) => ({
    time: formatTime(alert.updated_at ?? alert.created_at),
    title: alert.title,
    kind: alert.severity === "critical" ? "critical" : alert.source_name?.toLowerCase().includes("backup") ? "backup" : "network",
  }));
}

function buildInboxItems(alerts: RecentAlertResponse[]): InboxItem[] {
  if (!alerts.length) {
    return [];
  }
  return alerts.slice(0, 8).map((alert) => ({
    id: String(alert.id),
    type: alert.status,
    title: alert.title,
    source: alert.source_name ?? alert.source ?? "Security Center",
    time: formatTime(alert.updated_at ?? alert.created_at),
    severity: normalizeSeverity(alert.severity),
    why: "Alert generato dal backend Security Center AI.",
    recommendation: "Usare la console per triage, evidenze e lifecycle.",
  }));
}

function buildSeverityDistribution(dashboard: DashboardSummaryResponse) {
  const critical = dashboard.critical_alerts_count;
  const watch = Math.max(dashboard.open_alerts_count - critical, 0);
  const silent = dashboard.kpi_summary?.empty_state ? 0 : Object.keys(dashboard.kpi_summary?.counters ?? {}).length;
  return [
    { name: "Critici", value: critical, color: "#ef4444" },
    { name: "Da monitorare", value: watch, color: "#f59e0b" },
    { name: "Silenziati", value: silent, color: "#2563eb" },
  ];
}

function buildKpiCounters(dashboard: DashboardSummaryResponse) {
  return Object.entries(dashboard.kpi_summary?.counters ?? {})
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 12);
}

function buildDays(dashboard: DashboardSummaryResponse): DayKpi[] {
  const trends = dashboard.kpi_summary?.trends ?? [];
  return trends.slice(-7).map((item) => ({
    label: new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(new Date(item.date)),
    score: item.total,
    alerts: item.total,
    state: item.total > 10 ? "warning" : item.total > 0 ? "watch" : "ok",
  }));
}

function moduleScore(status: string) {
  if (status === "enabled") return 94;
  if (status === "warning") return 78;
  if (status === "misconfigured") return 56;
  return 68;
}

function moduleTone(status: string): ModuleStatus["tone"] {
  if (status === "enabled") return "good";
  if (status === "misconfigured") return "danger";
  return "warning";
}

function moduleIcon(code: string): IconName {
  if (code.includes("backup")) return "disk";
  if (code.includes("email")) return "mail";
  if (code.includes("watchguard")) return "network";
  return "shield";
}

function normalizeSeverity(value: string): Severity {
  if (["critical", "high", "medium", "warning", "low"].includes(value)) {
    return value as Severity;
  }
  return "medium";
}

function mapParseStatus(value: string): ReportItem["status"] {
  const normalized = value.toLowerCase();
  if (normalized === "parsed" || normalized === "processed" || normalized === "success") return "Processed";
  if (normalized === "failed" || normalized === "error") return "Failed";
  if (normalized === "suppressed" || normalized === "skipped") return "Suppressed";
  return "Pending";
}

function buildReportDetail(reportType?: string, inputKind?: string) {
  const type = reportType ? reportType.replace(/_/g, " ") : "report normalizzato";
  const input = inputKind === "mailbox" ? "mailbox" : inputKind === "file" ? "file" : "input manuale";
  return `${type} da ${input}`;
}

function mapDedupStatus(value?: InboxRecentResponse["recent_reports"][number]["dedup_status"]) {
  if (!value) {
    return undefined;
  }
  const state: "tracked" | "missing" | "unknown" = value.state === "tracked" || value.state === "missing" ? value.state : "unknown";
  return {
    state,
    label: value.label || "Deduplica",
    detail: value.detail || "",
    duplicates: value.duplicates ?? 0,
    inputLinked: Boolean(value.input_linked),
  };
}

function mapTimelineItem(item: { kind: string; label: string; status: string; at?: string | null; detail: string; count: number }) {
  const status: "done" | "attention" | "pending" = item.status === "done" || item.status === "attention" || item.status === "pending" ? item.status : "pending";
  return {
    kind: item.kind,
    label: item.label,
    status,
    at: item.at,
    detail: item.detail,
    count: item.count,
  };
}

function parseReportActionTarget(reportId: string) {
  const [prefix, rawId] = reportId.split("-", 2);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("ID report non valido");
  }
  if (prefix === "mail") return { kind: "mailbox", id };
  if (prefix === "file") return { kind: "file", id };
  if (prefix === "report") return { kind: "report", id };
  throw new Error("Tipo report non supportato");
}

function mapRetryResponse(response: InboxRetryResponse): ReportActionResult {
  return {
    itemKind: response.item_kind,
    id: response.id,
    sourceReportId: response.source_report_id,
    previousStatus: response.previous_status,
    parseStatus: response.parse_status,
    status: response.status,
    processed: response.processed,
    parserDetected: response.parser_detected,
    parserName: response.parser_name,
    reportsParsed: response.reports_parsed,
    metrics: response.metrics_count,
    events: response.events_count,
    alerts: response.alerts_count,
    evidence: response.evidence_count,
    tickets: response.tickets_count,
    warnings: response.warnings_count,
    errors: response.errors_count,
    message: response.message,
  };
}

function mapBulkRetryResponse(response: InboxBulkRetryResponse): ReportBulkActionResult {
  return {
    total: response.summary.total,
    processed: response.summary.processed,
    success: response.summary.success,
    skipped: response.summary.skipped,
    failed: response.summary.failed,
    reportsParsed: response.summary.reports_parsed,
    events: response.summary.events,
    alerts: response.summary.alerts,
    results: response.results.map(mapRetryResponse),
  };
}

function formatTime(value: string | null) {
  if (!value) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) {
    return undefined;
  }
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export const securityCenterApi = {
  baseUrl: API_BASE_URL,
  async getOverview() {
    return { data: await loadOverview(), source: "api" as const };
  },
  async getEvents() {
    return { data: await loadEvents(), source: "api" as const };
  },
  async getAssets() {
    return [];
  },
  async getReports() {
    return { data: await loadReports(), source: "api" as const };
  },
  async retryReportItem(reportId: string, forceReprocess = false) {
    const target = parseReportActionTarget(reportId);
    const response = await apiClient.post<InboxRetryResponse>(
      `/security/api/inbox/${target.kind}/${target.id}/retry/`,
      { force_reprocess: forceReprocess },
    );
    return { data: mapRetryResponse(response), source: "api" as const };
  },
  async retryReportItems(reportIds: string[], forceReprocess = false) {
    const items = reportIds.map(parseReportActionTarget);
    const response = await apiClient.post<InboxBulkRetryResponse>(
      "/security/api/inbox/bulk-retry/",
      { items, force_reprocess: forceReprocess },
    );
    return { data: mapBulkRetryResponse(response), source: "api" as const };
  },
  async getEvidence(): Promise<EvidenceItem[]> {
    return [];
  },
  async getRules(): Promise<RuleItem[]> {
    return [];
  },
};
