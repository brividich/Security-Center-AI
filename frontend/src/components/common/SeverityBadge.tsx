import type { Severity, Tone } from "../../types/securityCenter";

interface SeverityBadgeProps {
  children: string;
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  dark: "bg-slate-900 text-white ring-slate-700",
};

export function toneForSeverity(severity: Severity): Tone {
  if (severity === "critical") return "danger";
  if (severity === "high" || severity === "warning") return "warning";
  if (severity === "medium") return "info";
  return "neutral";
}

export function SeverityBadge({ children, tone = "neutral" }: SeverityBadgeProps) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}
