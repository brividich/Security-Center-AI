import { useEffect, useState } from "react";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { ConfigurationTabs, type ConfigurationTabKey } from "../components/configuration/ConfigurationTabs";
import { Icon } from "../components/common/Icon";
import {
  fetchConfigurationOverview,
  fetchConfigurationSources,
  fetchConfigurationRules,
  fetchConfigurationNotifications,
  fetchConfigurationSuppressions,
  ConfigurationApiError,
} from "../services/configurationApi";
import type { ReportSource, AlertRule, NotificationChannel, SuppressionRule } from "../types/configuration";
import type { PageKey } from "../types/securityCenter";

const validTabs: ConfigurationTabKey[] = ["sources", "rules", "notifications", "suppressions", "test", "users", "groups"];

function tabFromLocation(): ConfigurationTabKey {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return validTabs.includes(tab as ConfigurationTabKey) ? (tab as ConfigurationTabKey) : "sources";
}

export function ConfigurationStudioPage({ defaultTab, onNavigate }: { defaultTab?: ConfigurationTabKey; onNavigate?: (page: PageKey) => void } = {}) {
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionRule[]>([]);
  const [overview, setOverview] = useState({ active_sources: 0, active_rules: 0, active_channels: 0, active_suppressions: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigurationTabKey>(() => defaultTab ?? tabFromLocation());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    setAuthRequired(false);
    try {
      const [overviewData, sourcesData, rulesData, channelsData, suppressionsData] = await Promise.all([
        fetchConfigurationOverview(),
        fetchConfigurationSources(),
        fetchConfigurationRules(),
        fetchConfigurationNotifications(),
        fetchConfigurationSuppressions(),
      ]);

      setOverview({
        active_sources: overviewData.active_sources_count,
        active_rules: overviewData.active_alert_rules_count,
        active_channels: overviewData.active_notification_channels_count,
        active_suppressions: overviewData.active_suppressions_count,
      });

      setSources(sourcesData);
      setRules(rulesData);
      setChannels(channelsData);
      setSuppressions(suppressionsData);
    } catch (error) {
      console.warn("Impossibile caricare la configurazione dal backend:", error);
      const requiresAuth = error instanceof ConfigurationApiError && (error.status === 401 || error.status === 403);
      setAuthRequired(requiresAuth);
      setLoadError(error instanceof Error ? error.message : "Impossibile caricare la configurazione dal backend.");
      setSources([]);
      setRules([]);
      setChannels([]);
      setSuppressions([]);
      setOverview({ active_sources: 0, active_rules: 0, active_channels: 0, active_suppressions: 0 });
    } finally {
      setLoading(false);
    }
  }

  function handleTabChange(tab: ConfigurationTabKey) {
    setActiveConfigTab(tab);
    const nextPath = tab === "sources" ? "/configuration" : `/configuration?tab=${tab}`;
    window.history.replaceState(null, "", nextPath);
  }

  function openGraphPage() {
    if (onNavigate) {
      onNavigate("microsoft-graph");
      return;
    }
    window.history.pushState(null, "", "/integrations/microsoft-graph");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  const areas = [
    {
      label: "Sorgenti",
      value: overview.active_sources,
      detail: "Report, mailbox, upload e parser collegati",
      icon: "network" as const,
      tone: "border-cyan-200 bg-cyan-50 text-cyan-700",
      tab: "sources" as ConfigurationTabKey,
    },
    {
      label: "Regole",
      value: overview.active_rules,
      detail: "Condizioni che generano alert, evidence e ticket",
      icon: "settings" as const,
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
      tab: "rules" as ConfigurationTabKey,
    },
    {
      label: "Notifiche",
      value: overview.active_channels,
      detail: "Destinazioni operative per gli avvisi",
      icon: "mail" as const,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      tab: "notifications" as ConfigurationTabKey,
    },
    {
      label: "Silenziamenti",
      value: overview.active_suppressions,
      detail: "Rumore ridotto con scope e audit",
      icon: "silence" as const,
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      tab: "suppressions" as ConfigurationTabKey,
    },
  ];

  const workflowLinks = [
    { label: "Servizi", detail: "Controlla polling Graph e importazioni automatiche", page: "services" as PageKey },
    { label: "Monitor ingressi", detail: "Controlla mailbox, upload e alert recenti", page: "inbox" as PageKey },
    { label: "Report importati", detail: "Vedi report normalizzati e informazioni estratte", page: "reports" as PageKey },
    { label: "Microsoft Graph", detail: "Verifica credenziali, mailbox e ultimo sync", page: "microsoft-graph" as PageKey },
  ];

  const statusTone = authRequired
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : loadError
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const statusLabel = authRequired ? "Sessione richiesta" : loadError ? "API backend non disponibile" : "Collegato alle API backend";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="p-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Icon name="settings" className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">Studio Configurazione</h1>
                <p className="text-sm font-medium text-slate-500">Control Center per sorgenti, regole, notifiche e silenziamenti</p>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
              Gestisci cosa viene monitorato, quali condizioni aprono alert o ticket, dove arrivano le notifiche e quali eccezioni restano sotto controllo operativo.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${statusTone}`}>
                <Icon name={loadError ? "alert" : "check"} className="h-4 w-4" />
                {statusLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <Icon name="shield" className="h-4 w-4" />
                Dati letti dal backend
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-5 xl:border-l xl:border-t-0 lg:p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Azioni rapide</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
              onClick={loadData}
            >
                <Icon name="clock" className="h-4 w-4" />
              Aggiorna dati
            </button>
            <button
              type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
              onClick={openGraphPage}
            >
                <Icon name="network" className="h-4 w-4" />
              Microsoft Graph
            </button>
            </div>
            <div className="mt-5 space-y-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                Configura ingressi e parser
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Verifica regole e test
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Controlla consegna e rumore
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
          Caricamento configurazione backend...
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-bold">
            {authRequired ? "Il backend risponde, ma serve login o permesso." : "Backend non raggiungibile per lo Studio Configurazione."}
          </div>
          <div className="mt-1">
            {authRequired
              ? "Accedi con un utente autorizzato, poi torna qui e premi Riprova."
              : "Avvia il backend, controlla login e configurazione API, poi premi Riprova."}
          </div>
          <div className="mt-2 text-xs text-amber-800">{loadError}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
              onClick={loadData}
            >
              Riprova
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {areas.map((area) => (
          <button
            key={area.label}
            type="button"
            onClick={() => handleTabChange(area.tab)}
            className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${activeConfigTab === area.tab ? "border-slate-400" : "border-slate-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${area.tone}`}>
                <Icon name={area.icon} className="h-5 w-5" />
              </span>
              <span className="text-3xl font-bold text-slate-950">{area.value}</span>
            </div>
            <div className="mt-4 font-bold text-slate-800">{area.label}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{area.detail}</div>
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-slate-950">Percorso operativo</h2>
            <p className="mt-1 text-sm text-slate-500">Dopo aver configurato le sorgenti, passa a ingressi e report per verificare cosa sta arrivando davvero.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {workflowLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate?.(item.page)}
              className="group rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-2 font-bold text-slate-900">
                {item.label}
                <Icon name="chevron" className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <ErrorBoundary fallbackTitle="Errore nello Studio Configurazione">
        <ConfigurationTabs
          sources={sources}
          rules={rules}
          channels={channels}
          suppressions={suppressions}
          onRefresh={loadData}
          initialTab={activeConfigTab}
          onTabChange={handleTabChange}
        />
      </ErrorBoundary>

    </div>
  );
}
