export type ServiceHealth = "active" | "warning" | "error" | "running" | "not_configured" | "disabled";

export interface MailboxIngestionRunStatus {
  id: number;
  source_code: string;
  source_name: string;
  status: "pending" | "running" | "success" | "partial" | "failed" | string;
  status_label: string;
  started_at: string | null;
  finished_at: string | null;
  imported: number;
  skipped: number;
  duplicates: number;
  files: number;
  processed: number;
  alerts: number;
  error_message: string;
}

export interface MailboxIngestionSourceStatus {
  code: string;
  name: string;
  enabled: boolean;
  source_type: string;
  source_type_label: string;
  category: string;
  mailbox_address: string | null;
  health: ServiceHealth;
  health_label: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string;
  seconds_since_run: number | null;
  latest_run: MailboxIngestionRunStatus | null;
}

export interface MailboxIngestionServiceStatus {
  name: string;
  status: ServiceHealth;
  status_label: string;
  expected_interval_seconds: number;
  stale_after_seconds: number;
  polling_observed: boolean;
  polling_command: string;
  can_manage: boolean;
  totals: {
    sources: number;
    enabled_sources: number;
    graph_sources: number;
    sources_with_errors: number;
    sources_with_warnings: number;
    recent_runs: number;
  };
  latest_run: MailboxIngestionRunStatus | null;
  sources: MailboxIngestionSourceStatus[];
  recent_runs: MailboxIngestionRunStatus[];
}

export interface MailboxIngestionRunResponse {
  runs: Array<{
    id?: number;
    source_code: string;
    status: string;
    error?: string;
    imported_messages_count?: number;
    skipped_messages_count?: number;
    duplicate_messages_count?: number;
    imported_files_count?: number;
    processed_items_count?: number;
    generated_alerts_count?: number;
    error_message?: string;
  }>;
  service: MailboxIngestionServiceStatus;
}
