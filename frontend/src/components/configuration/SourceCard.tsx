import type { ReportSource } from "../../types/configuration";
import { navigateToClientPath } from "../../utils/clientNavigation";
import { Icon } from "../common/Icon";

interface SourceCardProps {
  source: ReportSource;
  onEdit?: (source: ReportSource) => void;
  onToggle?: (source: ReportSource) => void;
  onSync?: (source: ReportSource) => void;
  isSyncing?: boolean;
}

export function SourceCard({ source, onEdit, onToggle, onSync, isSyncing }: SourceCardProps) {
  const statusConfig = {
    active: { label: "Attivo", color: "bg-green-100 text-green-800" },
    to_configure: { label: "Da configurare", color: "bg-yellow-100 text-yellow-800" },
    error: { label: "Errore", color: "bg-red-100 text-red-800" },
    disabled: { label: "Disabilitato", color: "bg-gray-100 text-gray-600" },
  };

  const originConfig = {
    mailbox: "Mailbox",
    upload: "Upload",
    manual: "Manuale",
    graph: "Microsoft Graph",
  };

  const resultConfig = {
    success: { icon: "check" as const, color: "text-green-600" },
    warning: { icon: "alert" as const, color: "text-yellow-600" },
    error: { icon: "alert" as const, color: "text-red-600" },
  };

  const latestRun = source.latestRun;
  const syncStatus = latestRun ? runStatusConfig(latestRun.status) : null;
  const syncError = latestRun?.errorMessage || source.lastErrorMessage;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">{source.name}</h3>
          <p className="mt-1 text-sm text-slate-600">Parser: {source.parser}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusConfig[source.status].color}`}>
          {statusConfig[source.status].label}
        </span>
      </div>

      <div className={`mb-4 rounded-lg border p-3 text-sm ${syncStatus?.panelClass ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold">Stato sync</div>
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${syncStatus?.badgeClass ?? "bg-slate-100 text-slate-700"}`}>
            {syncStatus?.label ?? "Mai eseguito"}
          </span>
        </div>
        {latestRun ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <SyncMetric label="Avvio" value={formatDateTime(latestRun.startedAt)} />
            <SyncMetric label="Fine" value={formatDateTime(latestRun.finishedAt)} />
            <SyncMetric label="Importati" value={String(latestRun.imported)} />
            <SyncMetric label="Duplicati" value={String(latestRun.duplicates)} />
            <SyncMetric label="Processati" value={String(latestRun.processed)} />
            <SyncMetric label="Alert" value={String(latestRun.alerts)} />
          </div>
        ) : (
          <div className="mt-2 text-slate-500">Nessuna importazione registrata per questa sorgente.</div>
        )}
        {syncError && <div className="mt-2 font-semibold text-red-700">{syncError}</div>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500">Origine:</span>
          <span className="ml-2 font-medium text-slate-900">{originConfig[source.originType]}</span>
        </div>
        <div>
          <span className="text-slate-500">KPI:</span>
          <span className="ml-2 font-medium text-slate-900">{source.kpiCount}</span>
        </div>
        <div>
          <span className="text-slate-500">Alert generati:</span>
          <span className="ml-2 font-medium text-slate-900">{source.alertsGenerated}</span>
        </div>
        <div className="flex items-center">
          <span className="text-slate-500">Ultima importazione:</span>
          {source.lastImport ? (
            <span className="ml-2 flex items-center gap-1 font-medium text-slate-900">
              {source.lastResult && <Icon name={resultConfig[source.lastResult].icon} className={`h-4 w-4 ${resultConfig[source.lastResult].color}`} />}
              {new Date(source.lastImport).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span className="ml-2 text-slate-400">Mai</span>
          )}
        </div>
      </div>

      {source.warnings.length > 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 p-3">
          {source.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm text-yellow-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onEdit?.(source)}
          disabled={!onEdit}
        >
          <Icon name="settings" className="h-4 w-4" />
          Configura
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onToggle?.(source)}
          disabled={!onToggle}
        >
          <Icon name={source.status === "disabled" ? "check" : "silence"} className="h-4 w-4" />
          {source.status === "disabled" ? "Abilita" : "Disabilita"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onSync?.(source)}
          disabled={!onSync || isSyncing}
        >
          <Icon name="clock" className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Sync in corso..." : "Sync"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
          onClick={() => navigateToClientPath("/inbox")}
        >
          <Icon name="archive" className="h-4 w-4" />
          Vedi esecuzioni
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
          onClick={() => navigateToClientPath("/reports")}
        >
          <Icon name="file" className="h-4 w-4" />
          Report importati
        </button>
      </div>
    </div>
  );
}

function runStatusConfig(status: NonNullable<ReportSource["latestRun"]>["status"]) {
  const config = {
    pending: {
      label: "In attesa",
      badgeClass: "bg-blue-100 text-blue-700",
      panelClass: "border-blue-200 bg-blue-50 text-blue-950",
    },
    running: {
      label: "In corso",
      badgeClass: "bg-blue-100 text-blue-700",
      panelClass: "border-blue-200 bg-blue-50 text-blue-950",
    },
    success: {
      label: "Riuscito",
      badgeClass: "bg-green-100 text-green-800",
      panelClass: "border-green-200 bg-green-50 text-green-950",
    },
    partial: {
      label: "Parziale",
      badgeClass: "bg-yellow-100 text-yellow-800",
      panelClass: "border-yellow-200 bg-yellow-50 text-yellow-950",
    },
    failed: {
      label: "Fallito",
      badgeClass: "bg-red-100 text-red-800",
      panelClass: "border-red-200 bg-red-50 text-red-950",
    },
  };
  return config[status] ?? config.pending;
}

function formatDateTime(value: string | null) {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function SyncMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>
      <span className="ml-2 font-semibold text-slate-900">{value}</span>
    </div>
  );
}
