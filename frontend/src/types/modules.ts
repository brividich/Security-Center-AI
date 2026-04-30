import type { AlertRule, NotificationChannel, ReportSource, SuppressionRule } from "./configuration";
import type { IconName, PageKey, Severity, Tone } from "./securityCenter";

export type SecurityModuleKey = "watchguard" | "microsoft-defender" | "backup-nas" | "custom";
export type ModuleWorkspaceTab = "overview" | "sources" | "reports" | "kpi" | "alerts" | "rules" | "diagnostics";
export type ModuleHealthStatus = "attivo" | "attenzione" | "errore" | "non_configurato";
export type ModuleDataSource = "api";

export interface ModuleDefinition {
  key: SecurityModuleKey;
  pageKey: PageKey;
  path: string;
  title: string;
  shortTitle: string;
  description: string;
  guidance: string;
  icon: IconName;
  configLabel: string;
  docsLabel: string;
  sourceKeywords: string[];
  ruleKeywords: string[];
  expectedSources: string[];
}

export interface ModuleKpi {
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
  source: ModuleDataSource;
}

export interface ModuleAlert {
  id: string;
  title: string;
  severity: Severity;
  source: string;
  status: "aperto" | "in corso" | "silenziato";
  detail: string;
  sourceType: ModuleDataSource;
}

export interface ModuleRun {
  id: string;
  title: string;
  source: string;
  status: "successo" | "attenzione" | "errore";
  when: string | null;
  detail: string;
  sourceType: ModuleDataSource;
}

export interface ModuleDiagnosticCheck {
  id: string;
  label: string;
  status: "ok" | "warning" | "error" | "pending";
  detail: string;
  source: ModuleDataSource;
}

export interface ModuleWorkspaceData {
  definition: ModuleDefinition;
  status: ModuleHealthStatus;
  statusTone: Tone;
  sources: ReportSource[];
  rules: AlertRule[];
  notifications: NotificationChannel[];
  suppressions: SuppressionRule[];
  kpis: ModuleKpi[];
  alerts: ModuleAlert[];
  runs: ModuleRun[];
  diagnostics: ModuleDiagnosticCheck[];
  warnings: string[];
  configuredSourcesCount: number;
  openAlertsCount: number;
  criticalAlertsCount: number;
  latestRunStatus: string;
}
