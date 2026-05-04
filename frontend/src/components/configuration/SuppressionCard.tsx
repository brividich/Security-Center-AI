import type { SuppressionRule } from "../../types/configuration";
import { navigateToClientPath } from "../../utils/clientNavigation";
import { Icon } from "../common/Icon";

interface SuppressionCardProps {
  suppression: SuppressionRule;
}

export function SuppressionCard({ suppression }: SuppressionCardProps) {
  const typeConfig: Record<string, { label: string; color: string }> = {
    snooze: { label: "Snooze", color: "bg-blue-100 text-blue-800" },
    rule: { label: "Regola", color: "bg-purple-100 text-purple-800" },
    false_positive: { label: "Falso positivo", color: "bg-green-100 text-green-800" },
    muted_class: { label: "Classe silenziata", color: "bg-gray-100 text-gray-800" },
  };
  const type = typeConfig[suppression.type] ?? { label: String(suppression.type || "Silenziamento"), color: "bg-slate-100 text-slate-700" };
  const expiryDate = suppression.expiresAt ? new Date(suppression.expiresAt) : null;
  const expiryLabel = expiryDate && !Number.isNaN(expiryDate.getTime())
    ? expiryDate.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "Mai";

  const isExpired = expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate < new Date();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{suppression.reason}</h3>
            {isExpired && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Scaduto</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{suppression.scope}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${type.color}`}>
          {type.label}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500">Responsabile:</span>
          <span className="ml-2 font-medium text-slate-900">{suppression.owner}</span>
        </div>
        <div>
          <span className="text-slate-500">Scadenza:</span>
          <span className="ml-2 font-medium text-slate-900">{expiryLabel}</span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500">Alert soppressi:</span>
          <span className="ml-2 font-medium text-slate-900">{suppression.matchesSuppressed}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
          <Icon name="check" className="h-4 w-4" />
          Attivo in console
        </span>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200" onClick={() => navigateToClientPath("/configuration?tab=suppressions")}>
          <Icon name="clock" className="h-4 w-4" />
          Aggiorna vista
        </button>
      </div>
    </div>
  );
}
