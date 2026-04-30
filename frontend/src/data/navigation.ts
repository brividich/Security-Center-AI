import type { NavItem } from "../types/securityCenter";

export const navItems: NavItem[] = [
  { key: "overview", label: "Cruscotto KPI", icon: "shield", section: "operations", description: "KPI, priorita e salute pipeline" },
  { key: "inbox", label: "Monitor ingressi", icon: "mail", section: "operations", description: "Alert, mailbox, upload e input recenti" },
  { key: "reports", label: "Report importati", icon: "file", section: "operations", description: "Report normalizzati e informazioni estratte" },
  { key: "configuration", label: "Configurazione", icon: "settings", section: "control", description: "Cosa monitorare, regole e notifiche" },
  { key: "microsoft-graph", label: "Microsoft Graph", icon: "mail", section: "control", description: "Mailbox M365 e prerequisiti" },
  { key: "modules", label: "Aree modulo", icon: "grid", section: "control", description: "WatchGuard, Defender, Backup" },
  { key: "addons", label: "Registro add-on", icon: "disk", section: "control", description: "Copertura e diagnostica add-on" },
  { key: "assets", label: "Segnali asset", icon: "network", section: "analysis", description: "Host, utenti e concentrazioni" },
  { key: "rules", label: "Regole", icon: "silence", section: "analysis", description: "Decisioni alert e anti-rumore" },
  { key: "evidence", label: "Evidenze", icon: "archive", section: "analysis", description: "Tracce e contenitori audit" },
];
