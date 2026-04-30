import { Icon } from "../common/Icon";
import type { ModuleWorkspaceData } from "../../types/modules";
import { formatDate } from "../../utils/moduleAggregation";

interface ModuleOverviewProps {
  workspace: ModuleWorkspaceData;
  onConfigure: () => void;
}

export function ModuleOverview({ workspace, onConfigure }: ModuleOverviewProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Summary label="Sorgenti configurate" value={workspace.configuredSourcesCount} detail={`${workspace.sources.length} sorgenti collegate`} />
        <Summary label="Alert aperti" value={workspace.openAlertsCount} detail={`${workspace.criticalAlertsCount} critici`} />
        <Summary label="Regole correlate" value={workspace.rules.length} detail="Filtrate per keyword modulo" />
        <Summary label="Ultima esecuzione" value={workspace.latestRunStatus} detail="Da API configurazione quando disponibile" compact />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">KPI principali</h2>
            <p className="text-sm text-slate-500">Sintesi dai dati backend disponibili per il modulo.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {workspace.kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold uppercase text-slate-500">{kpi.label}</div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-950">{kpi.value}</div>
              <div className="mt-1 text-sm leading-5 text-slate-500">{kpi.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Ultimi report / run</h2>
              <p className="text-sm text-slate-500">Import noti dalle sorgenti configurate.</p>
            </div>
            <Icon name="clock" className="h-5 w-5 text-slate-500" />
          </div>
          <div className="space-y-3">
            {workspace.runs.map((run) => (
              <div key={run.id} className="rounded-lg bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-950">{run.title}</div>
                    <div className="text-sm text-slate-500">{run.source} - {formatDate(run.when)}</div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{run.status}</span>
                </div>
                <div className="mt-2 text-sm leading-5 text-slate-600">{run.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Avvisi e configurazione</h2>
          <div className="mt-4 space-y-3">
            {workspace.sources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="font-bold text-slate-950">Nessuna sorgente configurata per questo modulo.</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.definition.guidance}</p>
                <button onClick={onConfigure} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Aggiungi report da seguire
                </button>
              </div>
            ) : workspace.warnings.length ? (
              workspace.warnings.map((warning) => (
                <div key={warning} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Nessun avviso operativo rilevato.</div>
            )}
          </div>
          <button onClick={onConfigure} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Apri Studio Configurazione
          </button>
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value, detail, compact = false }: { label: string; value: string | number; detail: string; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`${compact ? "mt-2 text-sm leading-5" : "mt-2 text-2xl"} font-bold text-slate-950`}>{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </div>
  );
}
