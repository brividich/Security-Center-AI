import { Icon } from "../common/Icon";
import type { ModuleWorkspaceData } from "../../types/modules";
import { formatDate } from "../../utils/moduleAggregation";

interface ModuleSourcesTabProps {
  workspace: ModuleWorkspaceData;
  onConfigure: () => void;
}

const statusConfig = {
  active: { label: "Attiva", className: "bg-emerald-50 text-emerald-700" },
  to_configure: { label: "Da configurare", className: "bg-amber-50 text-amber-800" },
  error: { label: "Errore", className: "bg-red-50 text-red-700" },
  disabled: { label: "Disabilitata", className: "bg-slate-100 text-slate-600" },
};

export function ModuleSourcesTab({ workspace, onConfigure }: ModuleSourcesTabProps) {
  if (!workspace.sources.length) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <Icon name={workspace.definition.icon} className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="mt-3 font-bold text-slate-950">Nessuna sorgente configurata per questo modulo.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          {workspace.definition.guidance} Usa solo esempi sanitizzati per testare parser e regole.
        </p>
        <button onClick={onConfigure} className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Aggiungi report da seguire
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {workspace.sources.map((source) => (
        <section key={source.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">{source.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Parser: {source.parser}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusConfig[source.status].className}`}>
              {statusConfig[source.status].label}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Origine" value={source.originType} />
            <Detail label="Ultima importazione" value={formatDate(source.lastImport)} />
            <Detail label="KPI" value={source.kpiCount} />
            <Detail label="Alert generati" value={source.alertsGenerated} />
          </div>
          {source.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {source.warnings.map((warning) => (
                <div key={warning} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-950">{value}</div>
    </div>
  );
}
