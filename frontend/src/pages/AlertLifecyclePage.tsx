import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/common/Icon";
import { SeverityBadge, toneForSeverity } from "../components/common/SeverityBadge";
import { securityCenterApi } from "../services/api";
import type { InboxItem, PageKey, Severity } from "../types/securityCenter";

const statusLabels: Record<string, string> = {
  new: "Nuovo",
  open: "Aperto",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  snoozed: "Snoozed",
  muted: "Muted",
  closed: "Chiuso",
  resolved: "Risolto",
  false_positive: "Falso positivo",
  suppressed: "Soppresso",
};

const severityLabels: Record<Severity, string> = {
  critical: "Critico",
  high: "Alto",
  medium: "Medio",
  warning: "Attenzione",
  low: "Basso",
};

export function AlertLifecyclePage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [alerts, setAlerts] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "error">("api");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    securityCenterApi
      .getEvents()
      .then((result) => {
        if (!active) return;
        setAlerts(result.data);
        const routeId = alertIdFromLocation();
        setSelectedId(routeId && result.data.some((alert) => alert.id === routeId) ? routeId : result.data[0]?.id ?? null);
        setSource("api");
      })
      .catch(() => {
        if (!active) return;
        setAlerts([]);
        setSelectedId(null);
        setSource("error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const routeId = alertIdFromLocation();
      if (!routeId) return;
      setSelectedId(routeId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selected = alerts.find((alert) => alert.id === selectedId) ?? alerts[0];
  const counters = useMemo(
    () => ({
      critical: alerts.filter((alert) => alert.severity === "critical").length,
      high: alerts.filter((alert) => alert.severity === "high").length,
      active: alerts.filter((alert) => !["closed", "resolved", "false_positive"].includes(alert.type)).length,
    }),
    [alerts],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Operations</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-950">Alert lifecycle</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${source === "api" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {source === "api" ? "API live" : "API non disponibile"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Coda triage con stato, severita, sorgente e dettaglio alert gestito nella console React.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricPill label="Attivi" value={counters.active} tone="info" />
            <MetricPill label="Critici" value={counters.critical} tone="danger" />
            <MetricPill label="Alti" value={counters.high} tone="warning" />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Caricamento alert...</div>
      ) : source === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Non riesco a caricare gli alert dal backend.
        </div>
      ) : alerts.length === 0 ? (
        <EmptyAlertState onNavigate={onNavigate} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.25fr)]">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-950">Coda alert</h2>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <Icon name="filter" className="h-4 w-4" />
                Filtri
              </button>
            </div>
            <div className="max-h-[680px] overflow-auto">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => selectAlert(alert.id, setSelectedId)}
                  className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    selected?.id === alert.id ? "border-l-4 border-l-[var(--sc-orange)] bg-orange-50/40" : "border-l-4 border-l-transparent"
                  }`}
                >
                  <SeverityRail severity={alert.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <SeverityBadge tone={toneForSeverity(alert.severity)}>{severityLabels[alert.severity]}</SeverityBadge>
                      <StatusBadge status={alert.type} />
                      <span className="ml-auto font-mono text-[10px] text-slate-400">A-{alert.id}</span>
                    </span>
                    <span className="mt-2 block truncate text-sm font-semibold text-slate-900">{alert.title}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{alert.source} - {alert.time}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <AlertDetailPanel alert={selected} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
}

function AlertDetailPanel({ alert, onNavigate }: { alert?: InboxItem; onNavigate?: (page: PageKey) => void }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDetailOpen(false);
  }, [alert?.id]);

  useEffect(() => {
    if (!detailOpen) return;
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      detailRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [detailOpen]);

  if (!alert) return null;
  const currentAlert = alert;

  function openDetail() {
    selectAlert(currentAlert.id);
    setDetailOpen(true);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge tone={toneForSeverity(currentAlert.severity)}>{severityLabels[currentAlert.severity]}</SeverityBadge>
          <StatusBadge status={currentAlert.type} />
          <span className="font-mono text-xs text-slate-400">A-{currentAlert.id}</span>
          <span className="ml-auto text-xs font-semibold text-slate-500">Visto {currentAlert.time}</span>
        </div>
        <h2 className="mt-3 text-lg font-extrabold text-slate-950">{currentAlert.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sorgente <strong>{currentAlert.source}</strong>. Il dettaglio resta dentro la console React.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
        <button type="button" onClick={openDetail} className="inline-flex items-center gap-2 rounded-lg bg-[var(--sc-blue)] px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
          <Icon name="eye" className="h-4 w-4" />
          {detailOpen ? "Dettaglio aperto" : "Apri dettaglio"}
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => onNavigate?.("reports")}>
          Report collegati
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => onNavigate?.("evidence")}>
          Evidenze
        </button>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold text-slate-950">Decision trace</h3>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {currentAlert.why}
            <div className="mt-3 font-semibold text-slate-800">{currentAlert.recommendation}</div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-950">Audit e lifecycle</h3>
          <div className="mt-3 space-y-2">
            <AuditRow who="system" what="Alert ricevuto dalle API recenti" when={currentAlert.time} />
            <AuditRow who="console" what="Dettaglio gestito dalla route frontend /alerts/:id" when="React" />
          </div>
        </div>
      </div>

      {detailOpen ? (
        <div ref={detailRef} tabIndex={-1} className="border-t border-slate-200 bg-slate-50 p-5 outline-none">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-950">Dettaglio operativo</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Vista interna React per triage, stato e contesto dell'alert selezionato.
              </p>
            </div>
            <span className="rounded-lg bg-white px-3 py-2 font-mono text-xs font-bold text-slate-500 ring-1 ring-slate-200">/alerts/{currentAlert.id}</span>
          </div>
          <dl className="grid gap-3 md:grid-cols-2">
            <DetailField label="ID alert" value={`A-${currentAlert.id}`} />
            <DetailField label="Stato" value={statusLabels[currentAlert.type] ?? currentAlert.type} />
            <DetailField label="Severita" value={severityLabels[currentAlert.severity]} />
            <DetailField label="Sorgente" value={currentAlert.source} />
            <DetailField label="Ultimo aggiornamento" value={currentAlert.time} />
            <DetailField label="Percorso console" value={`/alerts/${currentAlert.id}`} />
          </dl>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Prossima azione</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{currentAlert.recommendation}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = ["closed", "resolved"].includes(status)
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : ["new", "open"].includes(status)
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : ["snoozed", "in_progress", "acknowledged"].includes(status)
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{statusLabels[status] ?? status}</span>;
}

function SeverityRail({ severity }: { severity: Severity }) {
  const color = severity === "critical" ? "bg-red-700" : severity === "high" ? "bg-red-500" : severity === "medium" || severity === "warning" ? "bg-amber-500" : "bg-blue-500";
  return <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${color}`} />;
}

function AuditRow({ who, what, when }: { who: string; what: string; when: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{who}</span>
      <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{what}</span>
      <span className="text-xs text-slate-500">{when}</span>
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: "info" | "warning" | "danger" }) {
  const toneClass = tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${toneClass}`}>
      <span className="font-mono text-lg leading-none">{value}</span>
      {label}
    </span>
  );
}

function EmptyAlertState({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-950">Nessun alert in coda</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        La sezione e' pronta: quando il backend espone alert recenti, compariranno qui con lifecycle e collegamenti a report/evidenze.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onNavigate?.("inbox")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Monitor ingressi
        </button>
        <button type="button" onClick={() => onNavigate?.("configuration")} className="rounded-lg bg-[var(--sc-blue)] px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
          Regole alert
        </button>
      </div>
    </section>
  );
}

function alertIdFromLocation() {
  const match = window.location.pathname.replace(/\/+$/, "").match(/^\/(?:security\/)?alerts\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function selectAlert(id: string, setter?: (id: string) => void) {
  setter?.(id);
  const nextPath = `/alerts/${encodeURIComponent(id)}`;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== nextPath) {
    window.history.pushState(null, "", nextPath);
  }
}
