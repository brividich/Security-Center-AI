import { useEffect, useState } from "react";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { ConfigurationTabs, type ConfigurationTabKey } from "../components/configuration/ConfigurationTabs";
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

const validTabs: ConfigurationTabKey[] = ["sources", "rules", "notifications", "suppressions", "test"];

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
      tab: "sources" as ConfigurationTabKey,
    },
    {
      label: "Regole",
      value: overview.active_rules,
      detail: "Condizioni che generano alert, evidence e ticket",
      tab: "rules" as ConfigurationTabKey,
    },
    {
      label: "Notifiche",
      value: overview.active_channels,
      detail: "Destinazioni operative per gli avvisi",
      tab: "notifications" as ConfigurationTabKey,
    },
    {
      label: "Silenziamenti",
      value: overview.active_suppressions,
      detail: "Rumore ridotto con scope e audit",
      tab: "suppressions" as ConfigurationTabKey,
    },
  ];

  const workflowLinks = [
    { label: "Monitor ingressi", detail: "Controlla mailbox, upload e alert recenti", page: "inbox" as PageKey },
    { label: "Report importati", detail: "Vedi report normalizzati e informazioni estratte", page: "reports" as PageKey },
    { label: "Microsoft Graph", detail: "Verifica credenziali, mailbox e ultimo sync", page: "microsoft-graph" as PageKey },
    { label: "Aree modulo", detail: "Guarda copertura per WatchGuard, Defender e Backup", page: "modules" as PageKey },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">Studio Configurazione</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${authRequired ? "bg-amber-50 text-amber-800" : loadError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {authRequired ? "Sessione richiesta" : loadError ? "API backend non disponibile" : "Collegato alle API backend"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Da qui gestisci cosa viene monitorato, quali regole generano alert, dove arrivano le notifiche e cosa viene silenziato. Questo e' il pannello principale di configurazione.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
              onClick={loadData}
            >
              Aggiorna dati
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={openGraphPage}
            >
              Microsoft Graph
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
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
              : "Avvia il backend su http://127.0.0.1:8000, controlla login e configurazione API, poi premi Riprova."}
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

      <div className="grid gap-3 md:grid-cols-4">
        {areas.map((area) => (
          <button
            key={area.label}
            type="button"
            onClick={() => handleTabChange(area.tab)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="text-2xl font-bold text-slate-950">{area.value}</div>
            <div className="mt-1 font-bold text-slate-800">{area.label}</div>
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
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="font-bold text-slate-900">{item.label}</div>
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
