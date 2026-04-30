import { useEffect, useState } from "react";
import type { ReportSource, AlertRule, NotificationChannel, SuppressionRule } from "../../types/configuration";
import { SourceCard } from "./SourceCard";
import { RuleCard } from "./RuleCard";
import { NotificationChannelCard } from "./NotificationChannelCard";
import { SuppressionCard } from "./SuppressionCard";
import { ConfigTestPanel } from "./ConfigTestPanel";
import SourceSetupWizard from "./SourceSetupWizard";
import { toggleSource } from "../../services/configurationApi";

export type ConfigurationTabKey = "sources" | "rules" | "notifications" | "suppressions" | "test";

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

  const tabs = [
    { key: "sources" as const, label: "Sorgenti report", count: sources.length },
    { key: "rules" as const, label: "Regole alert", count: rules.length },
    { key: "notifications" as const, label: "Notifiche", count: channels.length },
    { key: "suppressions" as const, label: "Silenziamenti", count: suppressions.length },
    { key: "test" as const, label: "Test configurazione", count: null },
  ];

  return (
    <div>
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {actionError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</div>}

        {activeTab === "sources" && (
          <div>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-600">
                Sorgenti report configurate e monitorate. Ogni sorgente rappresenta un flusso di dati di sicurezza.
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Aggiungi report da seguire
              </button>
            </div>
            {sources.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {sources.map((source) => (
                  <SourceCard key={source.id} source={source} onEdit={handleEditSource} onToggle={handleToggleSource} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
                <h3 className="font-bold text-slate-950">Nessuna sorgente configurata</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Aggiungi una sorgente per dire al backend quali report seguire, quali parser usare e quali condizioni devono generare alert.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Aggiungi report da seguire
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            <div className="mb-4">
              <p className="text-sm text-slate-600">
                Regole che determinano quando generare alert, creare evidence container e aprire ticket di remediation.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {rules.length ? (
                rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 md:col-span-2">
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
            <div className="mb-4">
              <p className="text-sm text-slate-600">
                Canali di notifica configurati per la consegna degli alert operativi.
              </p>
            </div>
            {channels.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {channels.map((channel) => (
                  <NotificationChannelCard key={channel.id} channel={channel} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
                <h3 className="font-bold text-slate-950">Nessun canale notifica disponibile</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Configura i canali nella console e poi aggiorna questa vista.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "suppressions" && (
          <div>
            <div className="mb-4">
              <p className="text-sm text-slate-600">
                Regole di soppressione attive per ridurre il rumore e gestire falsi positivi.
              </p>
            </div>
            {suppressions.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {suppressions.map((suppression) => (
                  <SuppressionCard key={suppression.id} suppression={suppression} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
                <h3 className="font-bold text-slate-950">Nessun silenziamento attivo</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Qui compariranno snooze, falsi positivi e regole di soppressione attive.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "test" && <ConfigTestPanel />}
      </div>

      {showWizard && (
        <SourceSetupWizard
          onClose={handleCloseWizard}
          onSuccess={handleWizardSuccess}
          editingSource={editingSource}
        />
      )}
    </div>
  );
}
