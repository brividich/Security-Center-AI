import type {
  AssetSignal,
  DayKpi,
  EvidenceItem,
  InboxItem,
  ModuleStatus,
  NavItem,
  PipelineStep,
  ReportItem,
  RuleItem,
  TimelineItem,
} from "../types/securityCenter";

export const navItems: NavItem[] = [
  { key: "overview", label: "Command Center", icon: "shield" },
  { key: "addons", label: "Addons", icon: "disk" },
  { key: "inbox", label: "Event Inbox", icon: "mail" },
  { key: "assets", label: "Asset Signals", icon: "network" },
  { key: "reports", label: "Reports", icon: "file" },
  { key: "evidence", label: "Evidence", icon: "archive" },
  { key: "rules", label: "Rules", icon: "silence" },
];

export const days: DayKpi[] = [
  { label: "20", score: 91, alerts: 3, state: "ok" },
  { label: "21", score: 94, alerts: 2, state: "ok" },
  { label: "22", score: 88, alerts: 4, state: "watch" },
  { label: "23", score: 96, alerts: 1, state: "ok" },
  { label: "24", score: 81, alerts: 6, state: "watch" },
  { label: "25", score: 78, alerts: 5, state: "warning" },
  { label: "26", score: 72, alerts: 7, state: "critical" },
];

export const modules: ModuleStatus[] = [
  { key: "sec", title: "Security", score: 72, subtitle: "1 critical · 3 warning", tone: "danger", icon: "shield" },
  { key: "net", title: "Network", score: 84, subtitle: "VPN spike · botnet blocked", tone: "warning", icon: "network" },
  { key: "backup", title: "Backup", score: 94, subtitle: "1 missing · 1 long job", tone: "good", icon: "disk" },
  { key: "mail", title: "Ingestion", score: 98, subtitle: "12 report normalizzati", tone: "good", icon: "mail" },
];

export const inboxItems: InboxItem[] = [
  {
    id: "DEF-CVE-001",
    type: "Critical vulnerability",
    title: "OpenSSL CVE Critical su 58 dispositivi",
    source: "Microsoft Defender",
    time: "08:02",
    severity: "critical",
    why: "CVSS 9.8, severity Critical, exposed devices sopra soglia",
    recommendation: "Aprire remediation plan e collegare evidenze Defender",
  },
  {
    id: "WG-BOT-025",
    type: "Blocked threat volume",
    title: "Botnet Detection: 2.4K eventi bloccati",
    source: "WatchGuard Dimension",
    time: "07:32",
    severity: "high",
    why: "Volume significativo ma completamente bloccato dal firewall",
    recommendation: "Monitorare destinazioni e confrontare con media ultimi 7 giorni",
  },
  {
    id: "VPN-REC-166",
    type: "VPN anomaly",
    title: "166 accessi SSL VPN allowed, molte riconnessioni brevi",
    source: "Firebox Auth CSV",
    time: "07:25",
    severity: "medium",
    why: "Picco rispetto alla baseline, nessun denied associato",
    recommendation: "Verificare client VPN e stabilità linea utente principale",
  },
  {
    id: "BCK-MISS-007",
    type: "Backup missing",
    title: "Backup mancante per PC-UFFICIO-07",
    source: "Synology Active Backup",
    time: "00:45",
    severity: "warning",
    why: "Client atteso nel piano giornaliero ma nessuna mail di completamento ricevuta",
    recommendation: "Controllare agent e ultimo contatto NAS",
  },
];

export const evidence: EvidenceItem[] = [
  { name: "Email originale Defender", status: "stored", meta: "message_id + html snapshot" },
  { name: "Parser JSON", status: "stored", meta: "CVE, CVSS, severity, exposed_devices" },
  { name: "Decision trace", status: "stored", meta: "rule critical_vulnerability_cvss_9" },
  { name: "Azioni utente", status: "open", meta: "ack/snooze/remediation pending" },
];

export const sourcePipeline: PipelineStep[] = [
  { name: "Mailbox", value: 12, detail: "messaggi letti" },
  { name: "Parser", value: 12, detail: "report riconosciuti" },
  { name: "Dedup", value: 2, detail: "duplicati scartati" },
  { name: "KPI", value: 38, detail: "metriche salvate" },
  { name: "Alert", value: 7, detail: "alert generati" },
  { name: "Silent", value: 42, detail: "eventi soppressi" },
];

export const assets: AssetSignal[] = [
  { name: "Fleet endpoint", status: "Critical", signal: "58 exposed devices", owner: "IT" },
  { name: "NovicromFW", status: "Watch", signal: "2.4K botnet blocked", owner: "IT" },
  { name: "PCFSANTUCCI", status: "Healthy", signal: "backup 14.4 GB", owner: "Ufficio" },
  { name: "PC-UFFICIO-07", status: "Warning", signal: "backup missing", owner: "Ufficio" },
  { name: "f.gentile", status: "Watch", signal: "165 VPN reconnect", owner: "Utente" },
];

export const timeline: TimelineItem[] = [
  { time: "00:18", title: "Backup BCK-PCFSANTUCCI completato", kind: "backup" },
  { time: "07:10", title: "EPDR Executive Report processato", kind: "report" },
  { time: "07:14", title: "ThreatSync Incident List normalizzato", kind: "report" },
  { time: "07:25", title: "CSV SSL VPN aggregato", kind: "network" },
  { time: "08:02", title: "Defender segnala CVE Critical OpenSSL", kind: "critical" },
];

export const reports: ReportItem[] = [
  { id: "RPT-001", name: "EPDR Executive Report", source: "WatchGuard", status: "Processed", metrics: 12, alerts: 1, receivedAt: "07:10" },
  { id: "RPT-002", name: "ThreatSync Incident List", source: "WatchGuard", status: "Processed", metrics: 9, alerts: 2, receivedAt: "07:14" },
  { id: "RPT-003", name: "SSL VPN Allowed CSV", source: "Firebox Auth", status: "Processed", metrics: 6, alerts: 1, receivedAt: "07:25" },
  { id: "RPT-004", name: "Backup Daily Mail", source: "Synology", status: "Pending", metrics: 4, alerts: 1, receivedAt: "00:45" },
  { id: "RPT-005", name: "Low closed incidents", source: "ThreatSync", status: "Suppressed", metrics: 7, alerts: 0, receivedAt: "06:48" },
];

export const rules: RuleItem[] = [
  { name: "Critical CVE", condition: "CVSS >= 9 OR severity = Critical", result: "Alert + Evidence", tone: "danger" },
  { name: "ThreatSync Low closed", condition: "severity = Low AND state = Closed", result: "KPI only", tone: "good" },
  { name: "VPN reconnect spike", condition: "vpn_count > baseline_7d + 40%", result: "Warning", tone: "warning" },
  { name: "Backup completed", condition: "status = Completed", result: "Positive KPI", tone: "good" },
];

export const severityDistribution = [
  { name: "Critical", value: 1, color: "#ef4444" },
  { name: "Watch", value: 3, color: "#f59e0b" },
  { name: "Silent", value: 42, color: "#2563eb" },
];
