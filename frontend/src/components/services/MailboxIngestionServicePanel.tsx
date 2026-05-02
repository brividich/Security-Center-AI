import { useEffect, useMemo, useState } from "react";
import { Icon } from "../common/Icon";
import { fetchMailboxIngestionServiceStatus, runMailboxIngestionService, ServiceStatusApiError } from "../../services/serviceStatusApi";
import type { MailboxIngestionServiceStatus, MailboxIngestionSourceStatus, ServiceHealth } from "../../types/serviceStatus";

interface MailboxIngestionServicePanelProps {
  title?: string;
  sourceCodes?: string[];
  compact?: boolean;
  onConfigure?: () => void;
}

const healthClasses: Record<ServiceHealth, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  running: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
  not_configured: "border-slate-200 bg-slate-50 text-slate-600",
  disabled: "border-slate-200 bg-slate-100 text-slate-600",
};

export function MailboxIngestionServicePanel({ title = "Servizio ingestion", sourceCodes, compact = false, onConfigure }: MailboxIngestionServicePanelProps) {
  const [status, setStatus] = useState<MailboxIngestionServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchMailboxIngestionServiceStatus();
      setStatus(result);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Impossibile caricare lo stato del servizio.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const visibleSources = useMemo(() => {
    const allSources = status?.sources ?? [];
    if (!sourceCodes?.length) return allSources;
    const allowed = new Set(sourceCodes);
    return allSources.filter((source) => allowed.has(source.code));
  }, [sourceCodes, status]);

  const latestVisibleRun = visibleSources
    .map((source) => source.latest_run)
    .filter(Boolean)
    .sort((left, right) => new Date(right?.started_at ?? 0).getTime() - new Date(left?.started_at ?? 0).getTime())[0];
  const panelPollingObserved = status
    ? sourceCodes?.length
      ? Boolean(latestVisibleRun?.started_at && (Date.now() - new Date(latestVisibleRun.started_at).getTime()) / 1000 <= status.stale_after_seconds)
      : status.polling_observed
    : false;

  const runNow = async (sourceCode?: string) => {
    const actionKey = sourceCode ?? "__all__";
    setRunningAction(actionKey);
    setActionError(null);
    try {
      const result = await runMailboxIngestionService(sourceCode);
      setStatus(result.service);
    } catch (error) {
      const message = error instanceof ServiceStatusApiError || error instanceof Error ? error.message : "Esecuzione non riuscita.";
      setActionError(message);
    } finally {
      setRunningAction(null);
    }
  };

  if (loading) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">Caricamento stato servizio...</section>;
  }

  if (loadError || !status) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="font-bold text-red-800">Stato servizio non disponibile</h2>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
        <button onClick={loadStatus} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-800">
          <Icon name="clock" className="h-4 w-4" />
          Riprova
        </button>
      </section>
    );
  }

  const panelStatus = derivePanelStatus(status, visibleSources, panelPollingObserved);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Icon name="clock" className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-slate-950">{title}</h2>
                <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${healthClasses[panelStatus.health]}`}>
                  {panelStatus.label}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Polling previsto ogni {Math.round(status.expected_interval_seconds / 60)} minuti. Ultima run: {formatDate(latestVisibleRun?.started_at ?? status.latest_run?.started_at ?? null)}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!sourceCodes?.length && (
              <button
                type="button"
                onClick={() => runNow()}
                disabled={runningAction !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="clock" className="h-4 w-4" />
                {runningAction === "__all__" ? "Esecuzione..." : "Esegui tutte"}
              </button>
            )}
            <button
              type="button"
              onClick={loadStatus}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Icon name="search" className="h-4 w-4" />
              Aggiorna
            </button>
            {onConfigure && (
              <button
                type="button"
                onClick={onConfigure}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Icon name="settings" className="h-4 w-4" />
                Configura
              </button>
            )}
          </div>
        </div>

        {actionError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</div>}

        {!compact && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-bold text-slate-800">Comando servizio</div>
            <code className="mt-1 block break-all font-mono text-[12px] text-slate-700">{status.polling_command}</code>
          </div>
        )}
      </div>

      <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-4">
        <ServiceMetric label="Sorgenti abilitate" value={visibleSources.filter((source) => source.enabled).length} detail={`${visibleSources.length} visibili`} />
        <ServiceMetric label="Graph" value={visibleSources.filter((source) => source.source_type === "graph").length} detail="Sorgenti Microsoft 365" />
        <ServiceMetric label="Errori" value={visibleSources.filter((source) => source.health === "error").length} detail="Da verificare" tone="danger" />
        <ServiceMetric label="Polling" value={panelPollingObserved ? "recente" : "non recente"} detail={`Soglia ${Math.round(status.stale_after_seconds / 60)} min`} tone={panelPollingObserved ? "good" : "warning"} />
      </div>

      <div className="divide-y divide-slate-100">
        {visibleSources.length ? visibleSources.map((source) => (
          <SourceServiceRow key={source.code} source={source} running={runningAction === source.code} onRun={() => runNow(source.code)} />
        )) : (
          <div className="p-5 text-sm text-slate-500">Nessuna sorgente collegata a questo tool.</div>
        )}
      </div>
    </section>
  );
}

function derivePanelStatus(status: MailboxIngestionServiceStatus, sources: MailboxIngestionSourceStatus[], pollingObserved: boolean) {
  if (!sources.length) return { health: "not_configured" as ServiceHealth, label: "Non configurato" };
  if (sources.some((source) => source.health === "error")) return { health: "error" as ServiceHealth, label: "Errori" };
  if (sources.some((source) => source.health === "warning") || !pollingObserved) return { health: "warning" as ServiceHealth, label: "Da monitorare" };
  return { health: status.status, label: status.status_label };
}

function ServiceMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string | number; detail: string; tone?: "neutral" | "good" | "warning" | "danger" }) {
  const valueClass = tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function SourceServiceRow({ source, running, onRun }: { source: MailboxIngestionSourceStatus; running: boolean; onRun: () => void }) {
  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-950">{source.name}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${healthClasses[source.health]}`}>{source.health_label}</span>
        </div>
        <div className="mt-1 text-sm text-slate-500">{source.source_type_label}{source.mailbox_address ? ` - ${source.mailbox_address}` : ""}</div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <RunCounter label="Importati" value={source.latest_run?.imported ?? 0} />
        <RunCounter label="Duplicati" value={source.latest_run?.duplicates ?? 0} />
        <RunCounter label="Processati" value={source.latest_run?.processed ?? 0} />
        <RunCounter label="Alert" value={source.latest_run?.alerts ?? 0} />
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <div className="text-xs text-slate-500">Ultima: {formatDate(source.latest_run?.started_at ?? source.last_run_at)}</div>
        <button
          type="button"
          onClick={onRun}
          disabled={running || !source.enabled}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="clock" className="h-4 w-4" />
          {running ? "Esecuzione..." : "Esegui ora"}
        </button>
      </div>
      {source.last_error_message && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 lg:col-span-3">{source.last_error_message}</div>}
    </div>
  );
}

function RunCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-950">{value}</div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "mai";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "non disponibile";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
