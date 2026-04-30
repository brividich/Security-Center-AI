import { Icon } from "../common/Icon";
import type { ModuleWorkspaceData } from "../../types/modules";

interface ModuleCardProps {
  module: ModuleWorkspaceData;
  onOpen: () => void;
  onConfigure: () => void;
  onViewAlerts: () => void;
  onDiagnostics: () => void;
}

const statusClasses = {
  attivo: "border-emerald-200 bg-emerald-50 text-emerald-700",
  attenzione: "border-amber-200 bg-amber-50 text-amber-800",
  errore: "border-red-200 bg-red-50 text-red-700",
  non_configurato: "border-slate-200 bg-slate-100 text-slate-600",
};

export function ModuleCard({ module, onOpen, onConfigure, onViewAlerts, onDiagnostics }: ModuleCardProps) {
  const topWarnings = module.warnings.slice(0, 2);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white">
            <Icon name={module.definition.icon} className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950">{module.definition.title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{module.definition.description}</p>
            <p className="mt-2 text-sm font-medium leading-5 text-slate-700">{module.definition.guidance}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[module.status]}`}>
          {module.status === "non_configurato" ? "non configurato" : module.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Sorgenti" value={module.configuredSourcesCount} />
        <Metric label="Alert aperti" value={module.openAlertsCount} />
        <Metric label="Ultima esecuzione" value={module.latestRunStatus} compact />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {module.kpis.slice(0, 4).map((kpi) => (
          <div key={`${module.definition.key}-${kpi.label}`} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold uppercase text-slate-500">{kpi.label}</div>
            </div>
            <div className="mt-1 text-xl font-bold text-slate-950">{kpi.value}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{kpi.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 min-h-[56px] space-y-2">
        {topWarnings.length ? (
          topWarnings.map((warning) => (
            <div key={warning} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          ))
        ) : (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">Nessun avviso operativo rilevato.</div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={onOpen} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Apri modulo
        </button>
        <button onClick={onConfigure} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Configura sorgenti
        </button>
        <button onClick={onViewAlerts} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Vedi alert
        </button>
        <button onClick={onDiagnostics} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Diagnostica
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`${compact ? "mt-1 text-sm leading-5" : "mt-1 text-2xl"} font-bold text-slate-950`}>{value}</div>
    </div>
  );
}
