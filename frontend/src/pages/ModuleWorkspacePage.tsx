import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/common/Icon";
import { severityLabel } from "../data/uiLabels";
import { ModuleDiagnosticsTab } from "../components/modules/ModuleDiagnosticsTab";
import { ModuleOverview } from "../components/modules/ModuleOverview";
import { ModuleRulesTab } from "../components/modules/ModuleRulesTab";
import { ModuleSourcesTab } from "../components/modules/ModuleSourcesTab";
import { ModuleWorkspaceLayout } from "../components/modules/ModuleWorkspaceLayout";
import { MailboxIngestionServicePanel } from "../components/services/MailboxIngestionServicePanel";
import { fetchModuleWorkspaces } from "../services/moduleWorkspaceApi";
import type { ModuleKpi, ModuleRun, ModuleWorkspaceData, ModuleWorkspaceTab } from "../types/modules";
import type { PageKey, Severity } from "../types/securityCenter";
import { formatDate, moduleDefinitionByPage, pathForPageKey } from "../utils/moduleAggregation";

interface ModuleWorkspacePageProps {
  page: PageKey;
  onNavigate: (page: PageKey, tab?: ModuleWorkspaceTab) => void;
}

const severityClasses: Record<Severity, string> = {
  critical: "bg-red-50 text-red-700",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-amber-50 text-amber-800",
  warning: "bg-amber-50 text-amber-800",
  low: "bg-blue-50 text-blue-700",
};

const tabs: ModuleWorkspaceTab[] = ["overview", "sources", "reports", "kpi", "alerts", "rules", "service", "diagnostics"];

function tabFromLocation(): ModuleWorkspaceTab {
  const value = new URLSearchParams(window.location.search).get("tab");
  return tabs.includes(value as ModuleWorkspaceTab) ? (value as ModuleWorkspaceTab) : "overview";
}

export function ModuleWorkspacePage({ page, onNavigate }: ModuleWorkspacePageProps) {
  const [workspaces, setWorkspaces] = useState<ModuleWorkspaceData[]>([]);
  const [activeTab, setActiveTab] = useState<ModuleWorkspaceTab>(() => tabFromLocation());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    fetchModuleWorkspaces()
      .then((result) => {
        if (!active) return;
        setWorkspaces(result);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Impossibile caricare l'area modulo.");
        setWorkspaces([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setActiveTab(tabFromLocation());
  }, [page]);

  const definition = moduleDefinitionByPage(page);
  const workspace = useMemo(
    () => workspaces.find((item) => item.definition.pageKey === page),
    [page, workspaces],
  );

  if (!definition) {
    return <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">Modulo non trovato.</section>;
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
        Caricamento Area Modulo {definition.title}...
      </section>
    );
  }

  if (loadError || !workspace) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <h2 className="font-bold text-red-800">Non riesco a caricare {definition.title}.</h2>
        <p className="mt-2 text-sm leading-6 text-red-700">
          {loadError ?? "Modulo non presente nei dati disponibili. Controlla sorgenti e regole nello Studio Configurazione."}
        </p>
        <button
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
          onClick={() => onNavigate("configuration")}
        >
          Apri configurazione
        </button>
      </section>
    );
  }

  const handleTabChange = (tab: ModuleWorkspaceTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", pathForPageKey(page, tab));
  };

  return (
    <ModuleWorkspaceLayout
      workspace={workspace}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onBack={() => onNavigate("modules")}
      onConfigure={() => onNavigate("configuration")}
    >
      {renderTab(workspace, activeTab, () => onNavigate("configuration"))}
    </ModuleWorkspaceLayout>
  );
}

function renderTab(workspace: ModuleWorkspaceData, activeTab: ModuleWorkspaceTab, onConfigure: () => void) {
  switch (activeTab) {
    case "sources":
      return <ModuleSourcesTab workspace={workspace} onConfigure={onConfigure} />;
    case "reports":
      return <ReportsTab runs={workspace.runs} />;
    case "kpi":
      return <KpiTab kpis={workspace.kpis} />;
    case "alerts":
      return <AlertsTab workspace={workspace} />;
    case "rules":
      return <ModuleRulesTab workspace={workspace} />;
    case "service":
      return (
        <MailboxIngestionServicePanel
          title={`Servizio ${workspace.definition.shortTitle}`}
          sourceCodes={workspace.sources.map((source) => source.id)}
          compact
          onConfigure={onConfigure}
        />
      );
    case "diagnostics":
      return <ModuleDiagnosticsTab workspace={workspace} />;
    case "overview":
    default:
      return (
        <div className="space-y-5">
          <TailoredOverview workspace={workspace} />
          <ModuleOverview workspace={workspace} onConfigure={onConfigure} />
        </div>
      );
  }
}

function TailoredOverview({ workspace }: { workspace: ModuleWorkspaceData }) {
  if (workspace.definition.key === "watchguard") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">Copertura WatchGuard</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.definition.guidance}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {["EPDR", "ThreatSync Summary", "ThreatSync Incident List", "Dimension / Firebox"].map((item) => (
            <Coverage key={item} label={item} active={workspace.sources.some((source) => `${source.name} ${source.parser}`.toLowerCase().includes(item.split(" ")[0].toLowerCase()))} />
          ))}
        </div>
      </section>
    );
  }
  if (workspace.definition.key === "microsoft-defender") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">Regole Defender prioritarie</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.definition.guidance}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Coverage label="CVSS >= 9.0" active={workspace.rules.some((rule) => rule.when.toLowerCase().includes("cvss"))} />
          <Coverage label="dispositivi esposti > 0" active={workspace.rules.some((rule) => rule.when.toLowerCase().includes("espost") || rule.when.toLowerCase().includes("exposed"))} />
          <Coverage label="deduplica ticket" active={workspace.rules.some((rule) => `${rule.then} ${rule.deduplication}`.toLowerCase().includes("ticket"))} />
        </div>
      </section>
    );
  }
  if (workspace.definition.key === "backup-nas") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">Salute backup</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.definition.guidance}</p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
          Nessun calendario backup disponibile dalle API backend.
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-950">Sorgenti custom</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Aggiungi una sorgente custom dallo Studio Configurazione, testa il parser con un esempio sanitizzato e collega regole solo quando le metriche sono stabili.
      </p>
    </section>
  );
}

function Coverage({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      <div className="flex items-center gap-2 font-bold">
        <Icon name={active ? "check" : "circle"} className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-xs">{active ? "Rilevata" : "Non configurata"}</div>
    </div>
  );
}

function ReportsTab({ runs }: { runs: ModuleRun[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {runs.map((run) => (
        <section key={run.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">{run.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{run.source} - {formatDate(run.when)}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{run.status}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{run.detail}</p>
        </section>
      ))}
    </div>
  );
}

function KpiTab({ kpis }: { kpis: ModuleKpi[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <section key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-semibold uppercase text-slate-500">{kpi.label}</div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-950">{kpi.value}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{kpi.detail}</p>
        </section>
      ))}
    </div>
  );
}

function AlertsTab({ workspace }: { workspace: ModuleWorkspaceData }) {
  if (!workspace.alerts.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-950">Nessun alert aperto per questo modulo.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          La rotta alert filtrata per modulo non e ancora disponibile. Quando sara aggiunta, questo tab mostrera alert reali.
        </p>
      </section>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {workspace.alerts.map((alert) => (
        <section key={alert.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">{alert.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{alert.source} - {alert.status}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClasses[alert.severity]}`}>{severityLabel(alert.severity)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{alert.detail}</p>
        </section>
      ))}
    </div>
  );
}
