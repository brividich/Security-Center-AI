import type { Severity } from "../types/securityCenter";

export function addonStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    enabled: "Attivo",
    warning: "Attenzione",
    misconfigured: "Configurazione errata",
    disabled: "Disabilitato",
  };
  return labels[status] ?? status;
}

export function severityLabel(severity: Severity | string): string {
  const labels: Record<string, string> = {
    critical: "Critico",
    high: "Alto",
    medium: "Medio",
    warning: "Attenzione",
    low: "Basso",
    Critical: "Critico",
    Watch: "Da monitorare",
    Healthy: "In salute",
    Warning: "Attenzione",
    Processed: "Processato",
    Pending: "In attesa",
    Failed: "Errore",
    Suppressed: "Soppresso",
    stored: "Archiviato",
    open: "Aperto",
  };
  return labels[severity] ?? severity;
}

export function booleanLabel(value: boolean): string {
  return value ? "Si" : "No";
}

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    Alert: "Alert",
    Evidence: "Evidence Container",
    Ticket: "Ticket",
    KPI: "KPI",
    Warning: "Attenzione",
    "KPI only": "Solo KPI",
    "Positive KPI": "KPI positivo",
    "Alert + Evidence": "Alert + Evidence Container",
  };
  return labels[action] ?? action;
}
