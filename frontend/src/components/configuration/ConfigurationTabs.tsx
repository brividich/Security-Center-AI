import { useEffect, useState } from "react";
import type { ReportSource, AlertRule, NotificationChannel, SuppressionRule } from "../../types/configuration";
import { SourceCard } from "./SourceCard";
import { RuleCard } from "./RuleCard";
import { NotificationChannelCard } from "./NotificationChannelCard";
import { SuppressionCard } from "./SuppressionCard";
import { ConfigTestPanel } from "./ConfigTestPanel";
import SourceSetupWizard from "./SourceSetupWizard";
import { toggleSource, runSourceIngestion } from "../../services/configurationApi";
import { Icon } from "../common/Icon";
import { UsersPage } from "../../pages/UsersPage";
import { GroupsPage } from "../../pages/GroupsPage";
import { AIAssistantPage } from "../../pages/AIAssistantPage";

export type ConfigurationTabKey = "sources" | "rules" | "notifications" | "suppressions" | "test" | "users" | "groups" | "ai";

interface ConfigurationTabsProps {
  sources: ReportSource[];
  rules: AlertRule[];
  channels: NotificationChannel[];
  suppressions: SuppressionRule[];
  onRefresh: () => void;
  initialTab?: ConfigurationTabKey;
  onTabChange?: (tab: ConfigurationTabKey) => void;
}

export function ConfigurationTabs({ sources, rules, channels, suppressions, onRefresh, initialTab = "sources", onTabChange }: ConfigurationTabsProps) {
  const [activeTab, setActiveTab] = useState<ConfigurationTabKey>(initialTab);
  const [showWizard, setShowWizard] = useState(false);
  const [editingSource, setEditingSource] = useState<ReportSource | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleEditSource = (source: ReportSource) => {
    setEditingSource(source);
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingSource(null);
  };

  const handleWizardSuccess = () => {
    setShowWizard(false);
    setEditingSource(null);
    onRefresh();
  };

  const selectTab = (tab: ConfigurationTabKey) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleToggleSource = async (source: ReportSource) => {
    try {
      setActionError(null);
      await toggleSource(source.id);
      onRefresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossibile aggiornare la sorgente");
    }
  };

  const handleSyncSource = async (source: ReportSource) => {
    try {
      setActionError(null);
      setSyncingSourceId(source.id);
      await runSourceIngestion(source.id);
      onRefresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossibile avviare il sync della sorgente");
    } finally {
      setSyncingSourceId(null);
    }
  };

  const tabs = [
    { key: "sources" as const, label: "Sorgenti report", count: sources.length, icon: "network" as const },
    { key: "rules" as const, label: "Regole alert", count: rules.length, icon: "settings" as const },
    { key: "notifications" as const, label: "Notifiche", count: channels.length, icon: "mail" as const },
    { key: "suppressions" as const, label: "Silenziamenti", count: suppressions.length, icon: "silence" as const },
    { key: "test" as const, label: "Test configurazione", count: null, icon: "search" as const },
    { key: "users" as const, label: "Utenti", count: null, icon: "shield" as const },
    { key: "groups" as const, label: "Gruppi", count: null, icon: "grid" as const },
    { key: "ai" as const, label: "AI Assistant", count: null, icon: "bot" as const },
  ];
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-3">
        <nav className="grid gap-2 md:grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
              className={`flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                activeTab === tab.key
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon name={tab.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </span>
              {tab.count !== null && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key ? "bg-white/15 text-white" : "bg-white text-slate-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 lg:p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Icon name={activeTabMeta.icon} className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">{activeTabMeta.label}</h2>
              <p className="text-sm text-slate-500">{tabDescription(activeTab)}</p>
            </div>
          </div>
          {activeTab !== "sources" && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Icon name="clock" className="h-4 w-4" />
              Aggiorna vista
            </button>
          )}
        </div>

        {actionError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</div>}

        {activeTab === "sources" && (
          <div>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Icon name="network" className="h-4 w-4" />
                + Aggiungi report da seguire
              </button>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Icon name="clock" className="h-4 w-4" />
                Aggiorna vista
              </button>
            </div>
            {sources.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {sources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onEdit={handleEditSource}
                    onToggle={handleToggleSource}
                    onSync={handleSyncSource}
                    isSyncing={syncingSourceId === source.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
                <h3 className="font-bold text-slate-950">Nessuna sorgente configurata</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Aggiungi una sorgente per dire al backend quali report seguire, quali parser usare e quali condizioni devono generare alert.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Icon name="network" className="h-4 w-4" />
                  Aggiungi report da seguire
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            <div className="grid gap-4 md:grid-cols-2">
              {rules.length ? (
                rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 md:col-span-2">
                  <h3 className="font-bold text-slate-950">Nessuna regola disponibile</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Le regole arrivano dal backend. Se hai appena fatto login, premi Aggiorna dati.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div>
            {channels.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {channels.map((channel) => (
                  <NotificationChannelCard key={channel.id} channel={channel} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
                <h3 className="font-bold text-slate-950">Nessun canale notifica disponibile</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Configura i canali nella console e poi aggiorna questa vista.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "suppressions" && (
          <div>
            {suppressions.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {suppressions.map((suppression) => (
                  <SuppressionCard key={suppression.id} suppression={suppression} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
                <h3 className="font-bold text-slate-950">Nessun silenziamento attivo</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Qui compariranno snooze, falsi positivi e regole di soppressione attive.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "test" && <ConfigTestPanel />}

        {activeTab === "users" && <UsersPage />}

        {activeTab === "groups" && <GroupsPage />}

        {activeTab === "ai" && <AIAssistantPage />}
      </div>

      {showWizard && (
        <SourceSetupWizard
          onClose={handleCloseWizard}
          onSuccess={handleWizardSuccess}
          editingSource={editingSource}
        />
      )}
    </section>
  );
}

function tabDescription(tab: ConfigurationTabKey) {
  const descriptions: Record<ConfigurationTabKey, string> = {
    sources: "Flussi monitorati, parser, importazioni e stato sync.",
    rules: "Condizioni che decidono alert, evidence container e ticket.",
    notifications: "Canali operativi per la consegna degli avvisi.",
    suppressions: "Eccezioni e falsi positivi con scope verificabile.",
    test: "Verifica parser e impatto delle regole con campioni sanitizzati.",
    users: "Gestione utenti, permessi e assegnazione gruppi.",
    groups: "Gestione gruppi e ruoli per il controllo accessi.",
    ai: "Assistente AI per analisi report, suggerimenti regole e chat intelligente.",
  };
  return descriptions[tab];
}
