import type { AlertRule } from "../../types/configuration";
import { actionLabel } from "../../data/uiLabels";
import { Icon } from "../common/Icon";

interface RuleCardProps {
  rule: AlertRule;
}

export function RuleCard({ rule }: RuleCardProps) {
  const severityConfig: Record<string, { label: string; color: string }> = {
    critical: { label: "Critica", color: "bg-red-100 text-red-800" },
    high: { label: "Alta", color: "bg-orange-100 text-orange-800" },
    medium: { label: "Media", color: "bg-yellow-100 text-yellow-800" },
    warning: { label: "Attenzione", color: "bg-amber-100 text-amber-800" },
    low: { label: "Bassa", color: "bg-blue-100 text-blue-800" },
  };
  const severity = severityConfig[String(rule.severity ?? "").toLowerCase()] ?? {
    label: String(rule.severity || "N/D"),
    color: "bg-slate-100 text-slate-700",
  };
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  const lastMatchDate = rule.lastMatch ? new Date(rule.lastMatch) : null;
  const lastMatchLabel = lastMatchDate && !Number.isNaN(lastMatchDate.getTime())
    ? lastMatchDate.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "Mai";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">{rule.name}</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div>
              <span className="font-medium text-slate-700">Quando:</span>
              <span className="ml-2 text-slate-600">{rule.when}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Allora:</span>
              <span className="ml-2 text-slate-600">{rule.then}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${severity.color}`}>{severity.label}</span>
          {rule.enabled ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Icon name="check" className="h-3 w-3" />
              Attiva
            </span>
          ) : (
            <span className="text-xs text-slate-400">Disattiva</span>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500">Deduplica:</span>
          <span className="ml-2 font-medium text-slate-900">{rule.deduplication}</span>
        </div>
        <div>
          <span className="text-slate-500">Aggregazione:</span>
          <span className="ml-2 font-medium text-slate-900">{rule.aggregation}</span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500">Ultimo match:</span>
          <span className="ml-2 font-medium text-slate-900">{lastMatchLabel}</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {actions.length ? actions.map((action) => (
          <span key={action} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {actionLabel(action)}
          </span>
        )) : <span className="text-xs font-medium text-slate-500">Nessuna azione dichiarata</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" href="/configuration?tab=test">
          Test configurazione
        </a>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
          Gestita nella console
        </span>
      </div>
    </div>
  );
}
