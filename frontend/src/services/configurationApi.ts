import type { ReportSource, AlertRule, NotificationChannel, SuppressionRule, SourcePreset, CreateSourceRequest, UpdateSourceRequest } from "../types/configuration";
import { API_BASE_URL, API_TIMEOUT_MS } from "./config";

const API_BASE = API_BASE_URL;

export class ConfigurationApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ConfigurationApiError";
    this.status = status;
  }
}

interface ConfigurationOverview {
  monitored_sources_count: number;
  active_sources_count: number;
  sources_with_warnings_count: number;
  alert_rules_count: number;
  active_alert_rules_count: number;
  notification_channels_count: number;
  active_notification_channels_count: number;
  active_suppressions_count: number;
  latest_ingestion_status: string | null;
  latest_ingestion_at: string | null;
  open_alerts_count: number;
  critical_open_alerts_count: number;
}

interface ConfigTestRequest {
  source_type?: string;
  parser_code?: string;
  sample_text: string;
  filename?: string;
}

interface ConfigTestResult {
  parser_detected: string;
  parser_name: string;
  confidence: number;
  metrics_preview: Array<{ name: string; value: number }>;
  findings_preview: Array<{ type: string; count: number }>;
  would_generate_alert: boolean;
  would_create_evidence_container: boolean;
  would_create_ticket: boolean;
  warnings: string[];
  errors: string[];
}

export interface SourceIngestionResult {
  id: number;
  source_code: string;
  status: "pending" | "running" | "success" | "partial" | "failed";
  started_at: string | null;
  finished_at: string | null;
  imported_messages_count: number;
  skipped_messages_count: number;
  duplicate_messages_count: number;
  imported_files_count: number;
  processed_items_count: number;
  generated_alerts_count: number;
  error_message: string;
}

export interface GraphSettingsStatus {
  tenant_configured: boolean;
  client_configured: boolean;
  secret_configured: boolean;
  mail_folder: string;
  can_save: boolean;
  configured: boolean;
  updated_at: string | null;
}

export interface SaveGraphSettingsRequest {
  tenant_id: string;
  client_id: string;
  client_secret?: string;
  mail_folder: string;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const csrfToken = getCsrfToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        ...options?.headers,
      },
      credentials: "include",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      const detail = contentType.includes("application/json") ? await safeApiErrorDetail(response) : "";
      throw new ConfigurationApiError(
        `Errore API: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`,
        response.status,
      );
    }

    if (!contentType.includes("application/json")) {
      throw new ConfigurationApiError("Il backend ha restituito una risposta non JSON. Verifica login o URL API.", response.status);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ConfigurationApiError(`Timeout API dopo ${API_TIMEOUT_MS / 1000}s: ${endpoint}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function safeApiErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.detail === "string") return data.detail;
    return "";
  } catch {
    return "";
  }
}

export async function fetchConfigurationOverview(): Promise<ConfigurationOverview> {
  return fetchApi<ConfigurationOverview>("/security/api/configuration/overview/");
}

export async function fetchConfigurationSources(): Promise<ReportSource[]> {
  const data = await fetchApi<any[]>("/security/api/configuration/sources/");
  return data.map(mapBackendSource);
}

function mapBackendSource(item: any): ReportSource {
  return {
    id: item.code || String(item.id),
    name: item.name,
    sourceType: item.source_type,
    enabled: item.enabled,
    status: mapBackendStatus(item.status),
    originType: mapBackendOrigin(item.origin),
    parser: item.parser_names?.[0] || "N/A",
    mailboxAddress: item.mailbox_address,
    attachmentExtensions: item.attachment_extensions,
    maxMessagesPerRun: item.max_messages_per_run,
    markAsReadAfterImport: item.mark_as_read_after_import,
    processAttachments: item.process_attachments,
    processEmailBody: item.process_email_body,
    lastImport: item.last_import_at,
    lastErrorMessage: item.last_error_message || null,
    lastResult: mapBackendResult(item.status),
    latestRun: item.latest_run ? {
      status: item.latest_run.status,
      startedAt: item.latest_run.started_at,
      finishedAt: item.latest_run.finished_at,
      imported: item.latest_run.imported || 0,
      skipped: item.latest_run.skipped || 0,
      duplicates: item.latest_run.duplicates || 0,
      files: item.latest_run.files || 0,
      processed: item.latest_run.processed || 0,
      alerts: item.latest_run.alerts || 0,
      errorMessage: item.latest_run.error_message || "",
    } : null,
    kpiCount: item.latest_run?.processed || 0,
    alertsGenerated: item.latest_run?.alerts || 0,
    warnings: item.warning_messages || [],
    links: item.links,
  };
}

export async function fetchConfigurationRules(): Promise<AlertRule[]> {
  const data = await fetchApi<any[]>("/security/api/configuration/rules/");
  return data.map((item) => ({
    id: item.code,
    name: item.title,
    when: item.when_summary,
    then: item.then_summary,
    severity: item.severity as any,
    deduplication: item.dedup_summary,
    aggregation: item.aggregation_summary,
    enabled: item.enabled,
    lastMatch: item.last_match_at,
    actions: extractActions(item.then_summary),
  }));
}

export async function fetchConfigurationNotifications(): Promise<NotificationChannel[]> {
  const data = await fetchApi<any[]>("/security/api/configuration/notifications/");
  return data.map((item) => ({
    id: item.code,
    type: item.code as any,
    name: item.name,
    enabled: item.enabled,
    destination: item.destination_summary,
    lastDelivery: item.last_delivery_at,
    errorState: item.warning_messages?.[0] || null,
  }));
}

export async function fetchConfigurationSuppressions(): Promise<SuppressionRule[]> {
  const data = await fetchApi<any[]>("/security/api/configuration/suppressions/");
  return data.map((item) => ({
    id: item.code || String(item.id),
    type: mapSuppressionType(item.type),
    reason: item.reason,
    owner: item.owner,
    expiresAt: item.expires_at,
    scope: item.scope_summary,
    matchesSuppressed: item.matches_suppressed_count || 0,
  }));
}

export async function testConfiguration(request: ConfigTestRequest): Promise<ConfigTestResult> {
  return fetchApi<ConfigTestResult>("/security/api/configuration/test/", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

function mapBackendStatus(status: string): ReportSource["status"] {
  const mapping: Record<string, ReportSource["status"]> = {
    active: "active",
    disabled: "disabled",
    error: "error",
    warning: "error",
    not_configured: "to_configure",
  };
  return mapping[status] || "to_configure";
}

function mapBackendOrigin(origin: string): ReportSource["originType"] {
  const mapping: Record<string, ReportSource["originType"]> = {
    mailbox: "mailbox",
    manual: "manual",
    upload: "upload",
    graph: "graph",
    graph_future: "graph",
    imap_future: "mailbox",
  };
  return mapping[origin] || "manual";
}

function mapBackendResult(status: string): "success" | "warning" | "error" | null {
  if (status === "active") return "success";
  if (status === "warning") return "warning";
  if (status === "error") return "error";
  return null;
}

function mapSuppressionType(type: string): SuppressionRule["type"] {
  const mapping: Record<string, SuppressionRule["type"]> = {
    snooze: "snooze",
    suppression_rule: "rule",
    false_positive: "false_positive",
    muted_class: "muted_class",
  };
  return mapping[type] || "rule";
}

function extractActions(thenSummary: string): string[] {
  const actions: string[] = [];
  if (thenSummary.includes("Alert")) actions.push("Alert");
  if (thenSummary.includes("Evidence")) actions.push("Evidence");
  if (thenSummary.includes("Ticket")) actions.push("Ticket");
  if (thenSummary.includes("KPI")) actions.push("KPI");
  return actions;
}

export async function fetchSourcePresets(): Promise<SourcePreset[]> {
  return fetchApi<SourcePreset[]>("/security/api/configuration/source-presets/");
}

export async function createSource(request: CreateSourceRequest): Promise<ReportSource> {
  const data = await fetchApi<any>("/security/api/configuration/sources/create/", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return mapBackendSource(data);
}

export async function updateSource(code: string, request: UpdateSourceRequest): Promise<ReportSource> {
  const data = await fetchApi<any>(`/security/api/configuration/sources/${code}/`, {
    method: "PATCH",
    body: JSON.stringify(request),
  });
  return mapBackendSource(data);
}

export async function toggleSource(code: string): Promise<{ enabled: boolean }> {
  return fetchApi<{ enabled: boolean }>(`/security/api/configuration/sources/${code}/toggle/`, {
    method: "POST",
  });
}

export async function runSourceIngestion(code: string, limit?: number): Promise<SourceIngestionResult> {
  return fetchApi<SourceIngestionResult>(`/security/api/configuration/sources/${code}/ingest/`, {
    method: "POST",
    body: JSON.stringify({
      ...(limit ? { limit } : {}),
      process_pipeline: true,
    }),
  });
}

export async function fetchGraphSettings(): Promise<GraphSettingsStatus> {
  return fetchApi<GraphSettingsStatus>("/security/api/configuration/graph/settings/");
}

export async function saveGraphSettings(request: SaveGraphSettingsRequest): Promise<GraphSettingsStatus> {
  return fetchApi<GraphSettingsStatus>("/security/api/configuration/graph/settings/", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
