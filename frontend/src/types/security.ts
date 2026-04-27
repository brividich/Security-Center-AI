export type AddonStatus = "enabled" | "disabled" | "warning" | "misconfigured";

export interface AddonLinks {
  api_detail: string;
  django_config: string;
  django_diagnostics: string;
  django_docs: string;
}

export interface AddonSummary {
  code: string;
  name: string;
  vendor: string;
  description: string;
  status: AddonStatus;
  status_reason: string;
  source_types: string[];
  parser_names: string[];
  total_source_count: number;
  enabled_source_count: number;
  total_parser_count: number;
  enabled_parser_count: number;
  total_rule_count: number;
  enabled_rule_count: number;
  open_alert_count: number;
  critical_alert_count: number;
  open_ticket_count: number;
  last_report_at: string | null;
  last_parser_warning_at: string | null;
  last_parser_error_at: string | null;
  warning_count: number;
  documentation_file: string;
  warnings: string[];
  misconfigurations: string[];
  links: AddonLinks;
}

export interface AddonSourceConfig {
  name: string;
  vendor: string;
  source_type: string;
  enabled: boolean;
  parser_name: string;
  expected_frequency: string;
  updated_at: string | null;
}

export interface AddonRuntimeSource {
  name: string;
  vendor: string;
  source_type: string;
  is_active: boolean;
}

export interface AddonParserConfig {
  parser_name: string;
  enabled: boolean;
  priority: number;
  source_type: string;
  input_type: string;
  description: string;
  updated_at: string | null;
}

export interface AddonAlertRule {
  code: string;
  name: string;
  enabled: boolean;
  source_type: string;
  metric_name: string;
  condition_operator: string;
  threshold_value: string;
  severity: string;
  auto_create_ticket: boolean;
  updated_at: string | null;
}

export interface AddonSuppression {
  name: string;
  source: string;
  event_type: string;
  severity: string;
  is_active: boolean;
  expires_at: string | null;
  hit_count: number;
  last_hit_at: string | null;
}

export interface AddonCountSummary {
  total: number;
  open: number;
  critical_open?: number;
}

export interface AddonLastReport {
  id: number;
  title: string;
  source: string;
  report_type: string;
  parser_name: string;
  parse_status: string;
  report_date: string | null;
  created_at: string | null;
}

export interface AddonDetail extends AddonSummary {
  sources: AddonSourceConfig[];
  runtime_sources: AddonRuntimeSource[];
  parsers: AddonParserConfig[];
  alert_rules: AddonAlertRule[];
  suppressions: AddonSuppression[];
  alerts_summary: AddonCountSummary;
  tickets_summary: AddonCountSummary;
  last_reports: AddonLastReport[];
}

export interface AddonRegistryResponse {
  addons: AddonSummary[];
}
