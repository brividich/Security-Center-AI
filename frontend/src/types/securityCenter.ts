import type { ReactNode } from "react";

export type PageKey =
  | "overview"
  | "addons"
  | "microsoft-graph"
  | "modules"
  | "module-watchguard"
  | "module-microsoft-defender"
  | "module-backup-nas"
  | "module-custom"
  | "inbox"
  | "assets"
  | "reports"
  | "evidence"
  | "services"
  | "rules"
  | "configuration";
export type Tone = "neutral" | "good" | "warning" | "danger" | "info" | "dark";
export type Severity = "critical" | "high" | "medium" | "warning" | "low";
export type IconName =
  | "shield"
  | "alert"
  | "network"
  | "disk"
  | "mail"
  | "bot"
  | "file"
  | "clock"
  | "search"
  | "filter"
  | "archive"
  | "calendar"
  | "silence"
  | "eye"
  | "check"
  | "chevron"
  | "grid"
  | "circle"
  | "settings";

export interface NavItem {
  key: PageKey;
  label: string;
  icon: IconName;
  section: "control" | "operations" | "analysis";
  description: string;
}

export interface DayKpi {
  label: string;
  score: number;
  alerts: number;
  state: "ok" | "watch" | "warning" | "critical";
}

export interface ModuleStatus {
  key: string;
  title: string;
  score: number;
  subtitle: string;
  tone: Exclude<Tone, "neutral" | "info" | "dark">;
  icon: IconName;
}

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  source: string;
  time: string;
  severity: Severity;
  why: string;
  recommendation: string;
}

export interface EvidenceItem {
  name: string;
  status: "stored" | "open";
  meta: string;
}

export interface PipelineStep {
  name: string;
  value: number;
  detail: string;
}

export interface AssetSignal {
  name: string;
  status: "Critical" | "Watch" | "Healthy" | "Warning";
  signal: string;
  owner: string;
}

export interface TimelineItem {
  time: string;
  title: string;
  kind: "backup" | "report" | "network" | "critical";
}

export interface ReportItem {
  id: string;
  kind: "report" | "mailbox" | "file";
  name: string;
  source: string;
  status: "Processed" | "Pending" | "Failed" | "Suppressed";
  metrics: number;
  events: number;
  alerts: number;
  evidence: number;
  tickets: number;
  warnings: number;
  receivedAt: string;
  parserName?: string;
  reportType?: string;
  reportDate?: string;
  sourceType?: string;
  inputKind?: string;
  linkedReportIds?: number[];
  dedupStatus?: ReportDedupStatus;
  timeline?: ReportTimelineItem[];
  tuningActions?: ReportTuningAction[];
  metricPreview?: Array<{ name: string; value: number; unit?: string }>;
  eventSummary?: Array<{ eventType: string; severity: string; total: number }>;
  alertSummary?: Array<{ status: string; severity: string; total: number }>;
  alertPreview?: ReportLinkedAlert[];
  ticketPreview?: ReportLinkedTicket[];
  evidencePreview?: ReportLinkedEvidence[];
  detail?: string;
}

export interface ReportDedupStatus {
  state: "tracked" | "missing" | "unknown";
  label: string;
  detail: string;
  duplicates: number;
  inputLinked: boolean;
}

export interface ReportTimelineItem {
  kind: string;
  label: string;
  status: "done" | "attention" | "pending";
  at?: string | null;
  detail: string;
  count: number;
}

export interface ReportTuningAction {
  kind: "parser" | "source" | "rules" | string;
  label: string;
  target: string;
  detail: string;
}

export interface ReportLinkedAlert {
  id: number;
  title: string;
  severity: string;
  status: string;
  sourceName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  detailUrl: string;
}

export interface ReportLinkedTicket {
  id: number;
  title: string;
  severity: string;
  status: string;
  sourceName: string;
  occurrenceCount: number;
  updatedAt?: string | null;
  detailUrl: string;
}

export interface ReportLinkedEvidence {
  id: string;
  title: string;
  status: string;
  sourceName: string;
  itemsCount: number;
  createdAt?: string | null;
}

export interface ReportActionResult {
  itemKind: "mailbox" | "file" | string;
  id: number;
  sourceReportId?: number | null;
  previousStatus: string;
  parseStatus: string;
  status: string;
  processed: boolean;
  parserDetected: boolean;
  parserName: string;
  reportsParsed: number;
  metrics: number;
  events: number;
  alerts: number;
  evidence: number;
  tickets: number;
  warnings: number;
  errors: number;
  message: string;
}

export interface ReportBulkActionResult {
  total: number;
  processed: number;
  success: number;
  skipped: number;
  failed: number;
  reportsParsed: number;
  events: number;
  alerts: number;
  results: ReportActionResult[];
}

export interface RuleItem {
  name: string;
  condition: string;
  result: string;
  tone: Tone;
}

export interface AppShellProps {
  active: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}
