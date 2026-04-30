import type { AlertRule, NotificationChannel, ReportSource, SuppressionRule } from "../types/configuration";
import type {
  ModuleDefinition,
  ModuleAlert,
  ModuleDiagnosticCheck,
  ModuleHealthStatus,
  ModuleKpi,
  ModuleRun,
  ModuleWorkspaceTab,
  ModuleWorkspaceData,
  SecurityModuleKey,
} from "../types/modules";
import type { PageKey, Tone } from "../types/securityCenter";

export const moduleDefinitions: ModuleDefinition[] = [
  {
    key: "watchguard",
    pageKey: "module-watchguard",
    path: "/modules/watchguard",
    title: "WatchGuard",
    shortTitle: "WatchGuard",
    description: "Area Modulo operativa per EPDR, ThreatSync, Dimension, Firebox e segnali VPN.",
    guidance: "Configura sorgenti report EPDR, ThreatSync e Dimension / Firebox.",
    icon: "shield",
    configLabel: "Configura sorgenti WatchGuard",
    docsLabel: "04_WATCHGUARD_ADDON.md",
    sourceKeywords: ["watchguard", "epdr", "threatsync", "dimension", "firebox", "vpn"],
    ruleKeywords: ["watchguard", "epdr", "threatsync", "firewall", "firebox", "malware", "pup", "botnet", "vpn"],
    expectedSources: ["EPDR", "ThreatSync Summary", "ThreatSync Incident List", "Dimension / Firebox"],
  },
  {
    key: "microsoft-defender",
    pageKey: "module-microsoft-defender",
    path: "/modules/microsoft-defender",
    title: "Microsoft Defender",
    shortTitle: "Defender",
    description: "Area Modulo per notifiche vulnerabilita Defender, CVE critiche e remediation deduplicata.",
    guidance: "Configura la sorgente delle notifiche vulnerabilita Microsoft Defender.",
    icon: "alert",
    configLabel: "Configura sorgenti Defender",
    docsLabel: "05_DEFENDER_ADDON.md",
    sourceKeywords: ["microsoft defender", "defender", "microsoft", "cve", "vulnerabil"],
    ruleKeywords: ["defender", "microsoft", "cve", "cvss", "exposed", "vulnerabil", "ticket", "dedup"],
    expectedSources: ["Notifiche vulnerabilita Defender"],
  },
  {
    key: "backup-nas",
    pageKey: "module-backup-nas",
    path: "/modules/backup-nas",
    title: "Backup / NAS",
    shortTitle: "Backup",
    description: "Area Modulo per Synology Active Backup, NAS, backup mancanti e anomalie operative.",
    guidance: "Configura la sorgente notifiche Synology Active Backup.",
    icon: "disk",
    configLabel: "Configura sorgenti Backup / NAS",
    docsLabel: "06_BACKUP_ADDON.md",
    sourceKeywords: ["backup", "nas", "synology", "active backup"],
    ruleKeywords: ["backup", "nas", "synology", "missing", "failed", "fallito", "mancante", "duration", "trasfer"],
    expectedSources: ["NAS / Synology", "Synology Active Backup"],
  },
  {
    key: "custom",
    pageKey: "module-custom",
    path: "/modules/custom",
    title: "Sorgenti custom",
    shortTitle: "Custom",
    description: "Area Modulo per report personalizzati, parser sperimentali e sorgenti non coperte dagli add-on principali.",
    guidance: "Crea una sorgente report custom e testa il riconoscimento parser.",
    icon: "grid",
    configLabel: "Aggiungi sorgente custom",
    docsLabel: "CONFIGURATION_STUDIO_API.md",
    sourceKeywords: ["custom", "personalizz", "manual", "other", "altro"],
    ruleKeywords: ["custom", "personalizz", "manual", "other", "altro"],
    expectedSources: ["Sorgente custom"],
  },
];

export const modulePageKeys = moduleDefinitions.map((definition) => definition.pageKey);

export function moduleDefinitionByPage(page: PageKey): ModuleDefinition | undefined {
  return moduleDefinitions.find((definition) => definition.pageKey === page);
}

export function moduleDefinitionByKey(key: SecurityModuleKey): ModuleDefinition {
  return moduleDefinitions.find((definition) => definition.key === key) ?? moduleDefinitions[0];
}

export function pageKeyForPath(pathname: string): PageKey | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/modules") return "modules";
  const match = moduleDefinitions.find((definition) => definition.path === normalized);
  return match?.pageKey ?? null;
}

export function pathForPageKey(page: PageKey, tab?: ModuleWorkspaceTab): string {
  if (page === "modules") return "/modules";
  if (page === "microsoft-graph") return "/integrations/microsoft-graph";
  const match = moduleDefinitions.find((definition) => definition.pageKey === page);
  if (match) {
    return tab && tab !== "overview" ? `${match.path}?tab=${tab}` : match.path;
  }
  const mapping: Partial<Record<PageKey, string>> = {
    overview: "/",
    addons: "/addons",
    inbox: "/inbox",
    assets: "/assets",
    reports: "/reports",
    evidence: "/evidence",
    rules: "/rules",
    configuration: "/configuration",
  };
  return mapping[page] ?? "/";
}

export function buildModuleWorkspaces(
  sources: ReportSource[],
  rules: AlertRule[],
  notifications: NotificationChannel[],
  suppressions: SuppressionRule[],
): ModuleWorkspaceData[] {
  return moduleDefinitions.map((definition) => {
    const moduleSources = sources.filter((source) => sourceBelongsToModule(source, definition));
    const relatedRules = rules.filter((rule) => ruleBelongsToModule(rule, definition));
    const runs = buildRunsFromSources(moduleSources);
    const kpis = buildKpisFromSources(moduleSources, definition.key);
    const alerts: ModuleAlert[] = [];
    const diagnostics = buildDiagnostics(definition, moduleSources, relatedRules, notifications);
    const warnings = collectWarnings(definition, moduleSources, diagnostics);
    const status = inferModuleStatus(moduleSources, alerts.length, warnings);

    return {
      definition,
      status,
      statusTone: toneForStatus(status),
      sources: moduleSources,
      rules: relatedRules,
      notifications,
      suppressions,
      kpis,
      alerts,
      runs,
      diagnostics,
      warnings,
      configuredSourcesCount: moduleSources.filter((source) => source.status !== "to_configure").length,
      openAlertsCount: alerts.filter((alert) => alert.status === "aperto" || alert.status === "in corso").length,
      criticalAlertsCount: alerts.filter((alert) => alert.severity === "critical").length,
      latestRunStatus: latestRunStatus(moduleSources),
    };
  });
}

export function sourceBelongsToModule(source: ReportSource, definition: ModuleDefinition): boolean {
  const haystack = normalize([source.id, source.name, source.parser, source.originType, ...source.warnings].join(" "));
  if (definition.key === "custom") {
    return definition.sourceKeywords.some((keyword) => haystack.includes(keyword)) || !moduleDefinitions
      .filter((item) => item.key !== "custom")
      .some((item) => item.sourceKeywords.some((keyword) => haystack.includes(keyword)));
  }
  return definition.sourceKeywords.some((keyword) => haystack.includes(keyword));
}

export function ruleBelongsToModule(rule: AlertRule, definition: ModuleDefinition): boolean {
  const haystack = normalize([rule.id, rule.name, rule.when, rule.then, rule.deduplication, rule.aggregation, ...rule.actions].join(" "));
  return definition.ruleKeywords.some((keyword) => haystack.includes(keyword));
}

export function inferModuleStatus(sources: ReportSource[], openAlertsCount: number, warnings: string[]): ModuleHealthStatus {
  if (!sources.length || sources.every((source) => source.status === "to_configure")) {
    return "non_configurato";
  }
  if (sources.some((source) => source.status === "error" || source.lastResult === "error")) {
    return "errore";
  }
  if (
    openAlertsCount > 0 ||
    warnings.length > 0 ||
    sources.some((source) => source.status === "disabled" || source.lastResult === "warning" || source.warnings.length > 0)
  ) {
    return "attenzione";
  }
  return "attivo";
}

export function toneForStatus(status: ModuleHealthStatus): Tone {
  if (status === "attivo") return "good";
  if (status === "errore") return "danger";
  if (status === "attenzione") return "warning";
  return "neutral";
}

function buildRunsFromSources(sources: ReportSource[]): ModuleRun[] {
  return sources
    .filter((source) => Boolean(source.lastImport))
    .sort((left, right) => new Date(right.lastImport ?? 0).getTime() - new Date(left.lastImport ?? 0).getTime())
    .slice(0, 4)
    .map((source) => ({
      id: `source-run-${source.id}`,
      title: source.name,
      source: source.parser,
      status: source.lastResult === "error" ? "errore" : source.lastResult === "warning" ? "attenzione" : "successo",
      when: source.lastImport,
      detail: `${source.kpiCount} KPI, ${source.alertsGenerated} alert generati nell'ultima esecuzione nota.`,
      sourceType: "api",
    }));
}

function buildKpisFromSources(sources: ReportSource[], key: SecurityModuleKey): ModuleKpi[] {
  const active = sources.filter((source) => source.status === "active").length;
  const kpiCount = sources.reduce((total, source) => total + source.kpiCount, 0);
  const generatedAlerts = sources.reduce((total, source) => total + source.alertsGenerated, 0);
  const warningCount = sources.reduce((total, source) => total + source.warnings.length + (source.lastResult === "warning" ? 1 : 0), 0);
  const realKpis: ModuleKpi[] = [
    { label: "Sorgenti attive", value: active, detail: `${sources.length} sorgenti associate al modulo.`, tone: active > 0 ? "good" : "neutral", source: "api" },
    { label: "KPI importati", value: kpiCount, detail: "Somma KPI dagli ultimi run noti delle sorgenti.", tone: kpiCount > 0 ? "info" : "neutral", source: "api" },
    { label: "Alert generati", value: generatedAlerts, detail: "Conteggio storico disponibile dalle API configurazione.", tone: generatedAlerts > 0 ? "warning" : "neutral", source: "api" },
    { label: "Avvisi sorgenti", value: warningCount, detail: "Avvisi dichiarati dalle sorgenti configurate.", tone: warningCount > 0 ? "warning" : "good", source: "api" },
  ];
  return realKpis;
}

function buildDiagnostics(
  definition: ModuleDefinition,
  sources: ReportSource[],
  rules: AlertRule[],
  notifications: NotificationChannel[],
): ModuleDiagnosticCheck[] {
  const checks: ModuleDiagnosticCheck[] = [
    {
      id: `${definition.key}-sources`,
      label: "Sorgenti configurate",
      status: sources.length ? "ok" : "warning",
      detail: sources.length ? `${sources.length} sorgenti rilevate per il modulo.` : `Nessuna sorgente ${definition.shortTitle} configurata.`,
      source: "api",
    },
    {
      id: `${definition.key}-rules`,
      label: "Regole alert correlate",
      status: rules.length ? "ok" : "warning",
      detail: rules.length ? `${rules.length} regole correlate trovate.` : "Nessuna regola correlata rilevata dalle keyword del modulo.",
      source: "api",
    },
    {
      id: `${definition.key}-notifications`,
      label: "Canali notifica attivi",
      status: notifications.some((channel) => channel.enabled) ? "ok" : "warning",
      detail: notifications.some((channel) => channel.enabled)
        ? `${notifications.filter((channel) => channel.enabled).length} canali attivi disponibili.`
        : "Nessun canale notifica attivo.",
      source: "api",
    },
  ];
  return checks;
}

function collectWarnings(definition: ModuleDefinition, sources: ReportSource[], diagnostics: ModuleDiagnosticCheck[]): string[] {
  if (!sources.length) {
    return ["Nessuna sorgente configurata per questo modulo.", definition.guidance];
  }
  const sourceWarnings = sources.flatMap((source) => source.warnings.map((warning) => `${source.name}: ${warning}`));
  const missingExpected = definition.expectedSources
    .filter((expected) => !sources.some((source) => normalize(`${source.name} ${source.parser}`).includes(normalize(expected).split(" ")[0])))
    .map((expected) => `${expected}: sorgente non rilevata o non riconoscibile.`);
  const diagnosticWarnings = diagnostics
    .filter((check) => check.source === "api" && (check.status === "warning" || check.status === "error"))
    .map((check) => check.detail);
  return [...sourceWarnings, ...missingExpected, ...diagnosticWarnings].slice(0, 6);
}

function latestRunStatus(sources: ReportSource[]): string {
  const latest = sources
    .filter((source) => Boolean(source.lastImport))
    .sort((left, right) => new Date(right.lastImport ?? 0).getTime() - new Date(left.lastImport ?? 0).getTime())[0];
  if (!latest) return "Nessuna importazione registrata";
  if (latest.lastResult === "error") return `Errore ultima importazione: ${formatDate(latest.lastImport)}`;
  if (latest.lastResult === "warning") return `Attenzione ultima importazione: ${formatDate(latest.lastImport)}`;
  return `Importazione riuscita: ${formatDate(latest.lastImport)}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
