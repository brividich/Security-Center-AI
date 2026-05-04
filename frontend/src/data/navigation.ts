import type { NavItem } from "../types/securityCenter";

export const navItems: NavItem[] = [
  { key: "overview", label: "Cruscotto KPI", icon: "shield", section: "operations", description: "KPI, priorita e salute pipeline" },
  { key: "inbox", label: "Monitor ingressi", icon: "mail", section: "operations", description: "Alert, mailbox, upload e input recenti" },
  { key: "alerts", label: "Alert", icon: "alert", section: "operations", description: "Lifecycle, triage e stato operativo" },
  { key: "reports", label: "Report importati", icon: "file", section: "operations", description: "Report normalizzati e informazioni estratte" },
  { key: "services", label: "Servizi", icon: "clock", section: "operations", description: "Polling Graph e stato ingestion" },
  { key: "configuration", label: "Configurazione", icon: "settings", section: "control", description: "Cosa monitorare, regole e notifiche" },
  { key: "microsoft-graph", label: "Microsoft Graph", icon: "mail", section: "control", description: "Mailbox M365 e prerequisiti" },
  { key: "modules", label: "Aree modulo", icon: "grid", section: "control", description: "WatchGuard, Defender, Backup" },
  { key: "addons", label: "Registro add-on", icon: "disk", section: "control", description: "Copertura e diagnostica add-on" },
  { key: "users", label: "Utenti", icon: "shield", section: "control", description: "Gestione utenti e permessi" },
  { key: "groups", label: "Gruppi", icon: "grid", section: "control", description: "Gestione gruppi e ruoli" },
  { key: "ai", label: "AI Assistant", icon: "bot", section: "control", description: "Chat AI, analisi report e suggerimenti" },
  { key: "assets", label: "Segnali asset", icon: "network", section: "analysis", description: "Host, utenti e concentrazioni" },
  { key: "rules", label: "Regole", icon: "silence", section: "analysis", description: "Decisioni alert e anti-rumore" },
  { key: "evidence", label: "Evidenze", icon: "archive", section: "analysis", description: "Tracce e contenitori audit" },
];
