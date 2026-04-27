import type { ReactNode } from "react";

export type PageKey = "overview" | "addons" | "inbox" | "assets" | "reports" | "evidence" | "rules";
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
  | "circle";

export interface NavItem {
  key: PageKey;
  label: string;
  icon: IconName;
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
  name: string;
  source: string;
  status: "Processed" | "Pending" | "Suppressed";
  metrics: number;
  alerts: number;
  receivedAt: string;
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
