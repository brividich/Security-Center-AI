import { Icon } from "../common/Icon";
import { actionLabel, severityLabel } from "../../data/uiLabels";
import type { ModuleWorkspaceData } from "../../types/modules";
import { formatDate } from "../../utils/moduleAggregation";

const severityClasses = {
  critical: "bg-red-50 text-red-700",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-blue-50 text-blue-700",
};

export function ModuleRulesTab({ workspace }: { workspace: ModuleWorkspaceData }) {
  if (!workspace.rules.length) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <Icon name="silence" className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="mt-3 font-bold text-slate-950">Nessuna regola correlata rilevata.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Le regole vengono filtrate per keyword del modulo. Aggiungi o rinomina regole nello Studio Configurazione per collegarle a questa Area Modulo.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {workspace.rules.map((rule) => (
        <section key={rule.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">{rule.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{rule.when}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClasses[rule.severity]}`}>{severityLabel(rule.severity)}</span>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-800">Azione:</span> {rule.then}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Deduplica" value={rule.deduplication} />
            <Detail label="Ultimo match" value={formatDate(rule.lastMatch)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {rule.actions.map((action) => (
              <span key={action} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{actionLabel(action)}</span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-950">{value}</div>
    </div>
  );
}
