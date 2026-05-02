import { Icon } from "../common/Icon";
import type { ModuleWorkspaceData, ModuleWorkspaceTab } from "../../types/modules";

interface ModuleWorkspaceLayoutProps {
  workspace: ModuleWorkspaceData;
  activeTab: ModuleWorkspaceTab;
  onTabChange: (tab: ModuleWorkspaceTab) => void;
  onBack: () => void;
  onConfigure: () => void;
  children: JSX.Element;
}

const tabs: Array<{ key: ModuleWorkspaceTab; label: string }> = [
  { key: "overview", label: "Panoramica" },
  { key: "sources", label: "Sorgenti" },
  { key: "reports", label: "Report" },
  { key: "kpi", label: "KPI" },
  { key: "alerts", label: "Alert" },
  { key: "rules", label: "Regole" },
  { key: "service", label: "Servizio" },
  { key: "diagnostics", label: "Diagnostica" },
];

const statusClasses = {
  attivo: "bg-emerald-50 text-emerald-700",
  attenzione: "bg-amber-50 text-amber-800",
  errore: "bg-red-50 text-red-700",
  non_configurato: "bg-slate-100 text-slate-600",
};

export function ModuleWorkspaceLayout({ workspace, activeTab, onTabChange, onBack, onConfigure, children }: ModuleWorkspaceLayoutProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">
            <Icon name="chevron" className="h-4 w-4 rotate-180" />
            Moduli
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-slate-950 text-white">
              <Icon name={workspace.definition.icon} className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-950">{workspace.definition.title}</h1>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[workspace.status]}`}>
                  {workspace.status === "non_configurato" ? "non configurato" : workspace.status}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{workspace.definition.description}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onConfigure} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {workspace.definition.configLabel}
          </button>
          <button onClick={() => onTabChange("diagnostics")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Diagnostica
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-5 overflow-x-auto" aria-label="Tab Area Modulo">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
