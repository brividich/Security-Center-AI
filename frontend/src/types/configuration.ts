export type SourceStatus = "active" | "to_configure" | "error" | "disabled";
export type SourceOriginType = "mailbox" | "upload" | "manual" | "graph";
export type SourceRunStatus = "pending" | "running" | "success" | "partial" | "failed";
export type RuleSeverity = "critical" | "high" | "medium" | "low";
export type ChannelType = "dashboard" | "email" | "teams" | "ticket" | "webhook_future";
export type SuppressionType = "snooze" | "rule" | "false_positive" | "muted_class";

export interface ReportSource {
  id: string;
  name: string;
  sourceType?: string;
  enabled?: boolean;
  status: SourceStatus;
  originType: SourceOriginType;
  parser: string;
  mailboxAddress?: string | null;
  attachmentExtensions?: string;
  maxMessagesPerRun?: number;
  markAsReadAfterImport?: boolean;
  processAttachments?: boolean;
  processEmailBody?: boolean;
  lastImport: string | null;
  lastResult: "success" | "warning" | "error" | null;
  lastErrorMessage?: string | null;
  latestRun?: {
    status: SourceRunStatus;
    startedAt: string | null;
    finishedAt: string | null;
    imported: number;
    skipped: number;
    duplicates: number;
    files: number;
    processed: number;
    alerts: number;
    errorMessage: string;
  } | null;
  kpiCount: number;
  alertsGenerated: number;
  warnings: string[];
  links?: {
    configuration_url?: string;
    inbox_url?: string;
    diagnostics_url?: string;
    reports_url?: string;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  when: string;
  then: string;
  severity: RuleSeverity;
  deduplication: string;
  aggregation: string;
  enabled: boolean;
  lastMatch: string | null;
  actions: string[];
}

export interface NotificationChannel {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  destination: string;
  lastDelivery: string | null;
  errorState: string | null;
}

export interface SuppressionRule {
  id: string;
  type: SuppressionType;
  reason: string;
  owner: string;
  expiresAt: string | null;
  scope: string;
  matchesSuppressed: number;
}

export interface ConfigTestResult {
  parserDetected: string;
  metricsExtracted: number;
  wouldGenerateAlert: boolean;
  evidenceContainer: boolean;
  ticket: boolean;
  warnings: string[];
}

export interface SourcePreset {
  preset_code: string;
  title: string;
  description: string;
  module: string;
  recommended_origin: string;
  default_name: string;
  code_prefix: string;
  source_type: string;
  sender_allowlist_text: string;
  subject_include_text: string;
  subject_exclude_text: string;
  body_include_text: string;
  attachment_extensions: string;
  max_messages_per_run: number;
  mark_as_read_after_import: boolean;
  process_attachments: boolean;
  process_email_body: boolean;
  parser_hints: string[];
  warning_messages: string[];
}

export interface CreateSourceRequest {
  preset_code?: string;
  name: string;
  code: string;
  enabled: boolean;
  source_type: string;
  mailbox_address?: string;
  description?: string;
  sender_allowlist_text?: string;
  subject_include_text?: string;
  subject_exclude_text?: string;
  body_include_text?: string;
  attachment_extensions?: string;
  max_messages_per_run?: number;
  mark_as_read_after_import?: boolean;
  process_attachments?: boolean;
  process_email_body?: boolean;
}

export interface UpdateSourceRequest {
  name?: string;
  enabled?: boolean;
  source_type?: string;
  mailbox_address?: string;
  description?: string;
  sender_allowlist_text?: string;
  subject_include_text?: string;
  subject_exclude_text?: string;
  body_include_text?: string;
  attachment_extensions?: string;
  max_messages_per_run?: number;
  mark_as_read_after_import?: boolean;
  process_attachments?: boolean;
  process_email_body?: boolean;
}
