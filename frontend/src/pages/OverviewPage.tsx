import { useEffect, useState } from "react";
import { securityCenterApi, type OverviewData } from "../services/api";
import type { ModuleStatus, PageKey, PipelineStep, TimelineItem } from "../types/securityCenter";
import { ChartBox } from "../components/charts/ChartBox";
import { Donut } from "../components/charts/Donut";
import { Card } from "../components/common/Card";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { Stat } from "../components/common/Stat";
import { EventTable } from "../components/tables/EventTable";
import { severityLabel } from "../data/uiLabels";

const moduleTitleLabels: Record<string, string> = {
  Security: "Sicurezza",
  Network: "Rete",
  Ingestion: "Ingestione",
};

const moduleSubtitleLabels: Record<string, string> = {
  "1 critical Â· 3 warning": "1 critico - 3 attenzioni",
  "1 critical · 3 warning": "1 critico - 3 attenzioni",
  "VPN spike Â· botnet blocked": "Picco VPN - botnet bloccata",
  "VPN spike · botnet blocked": "Picco VPN - botnet bloccata",
  "1 missing Â· 1 long job": "1 mancante - 1 job lungo",
  "1 missing · 1 long job": "1 mancante - 1 job lungo",
};

function moduleTitle(value: string): string {
  return moduleTitleLabels[value] ?? value;
}

function moduleSubtitle(value: string): string {
  return moduleSubtitleLabels[value] ?? value;
}

function ScoreRing({ value, tone = "good", size = 96 }: { value: number; tone?: ModuleStatus["tone"]; size?: number }) {
  const radius = 42;
  const stroke = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = tone === "danger" ? "text-red-500" : tone === "warning" ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-slate-200" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold text-slate-950">{value}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">punteggio</div>
      </div>
    </div>
  );
}

function ModuleCard({ item }: { item: ModuleStatus }) {
  const toneClass = item.tone === "danger" ? "bg-red-50 text-red-700" : item.tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  const barClass = item.tone === "danger" ? "bg-red-500" : item.tone === "warning" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <button className="group rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
            <Icon name={item.icon} className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-slate-950">{moduleTitle(item.title)}</div>
            <div className="text-sm text-slate-500">{moduleSubtitle(item.subtitle)}</div>
          </div>
        </div>
        <ScoreRing value={item.score} tone={item.tone} size={76} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${item.score}%` }} />
      </div>
    </button>
  );
}

function DayStrip({ days }: { days: OverviewData["days"] }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Navigazione temporale KPI</h2>
          <p className="text-sm text-slate-500">Scorri per giorno, confronta con media 7/30 giorni o stesso periodo precedente.</p>
        </div>
        <SeverityBadge tone="info">Aprile 2026</SeverityBadge>
      </div>
      {days.length ? (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
          const stateClass =
            day.state === "critical"
              ? "border-red-200 bg-red-50"
              : day.state === "warning"
                ? "border-amber-200 bg-amber-50"
                : day.state === "watch"
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50";
          return (
            <button key={day.label} className={`rounded-2xl border p-3 text-center transition hover:-translate-y-0.5 ${stateClass}`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">26/{day.label}</div>
              <div className="mt-1 text-xl font-bold text-slate-950">{day.score}</div>
              <div className="text-xs text-slate-500">{day.alerts} alert</div>
            </button>
          );
          })}
        </div>
      ) : (
        <EmptyState text="Nessun trend KPI disponibile dalle API backend." />
      )}
    </Card>
  );
}

function Pipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold">Pipeline di ingestione</h2>
          <p className="text-sm text-slate-400">Da mailbox/upload a KPI, alert ed evidence container.</p>
        </div>
        <Icon name="mail" className="h-5 w-5 text-blue-300" />
      </div>
      {steps.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => (
          <div key={step.name} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold">{step.value}</div>
            <div className="mt-1 text-sm font-semibold text-white">{step.name}</div>
            <div className="text-xs text-slate-400">{step.detail}</div>
          </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300 ring-1 ring-white/10">Nessun dato pipeline disponibile.</div>
      )}
    </section>
  );
}

function KpiDistribution({ counters, periodLabel }: { counters: OverviewData["kpiCounters"]; periodLabel: string }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-950">Distribuzione KPI</h2>
          <p className="text-sm text-slate-500">{periodLabel}</p>
        </div>
        <SeverityBadge tone="info">{`${counters.length} metriche`}</SeverityBadge>
      </div>
      {counters.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {counters.map((counter) => (
            <div key={counter.name} className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase text-slate-500">{formatKpiName(counter.name)}</div>
              <div className="mt-2 text-2xl font-bold text-slate-950">{counter.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="Nessun KPI aggregato disponibile. Verifica ingressi e parser report." />
      )}
    </Card>
  );
}

function AiPriority({ items, distribution }: { items: OverviewData["inboxItems"]; distribution: OverviewData["severityDistribution"] }) {
  const topItem = items[0];
  const criticalCount = distribution.find((item) => item.name === "Critici")?.value ?? 0;
  const watchCount = distribution.find((item) => item.name === "Da monitorare")?.value ?? 0;
  const silentCount = distribution.find((item) => item.name === "Silenziati")?.value ?? 0;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-blue-900 to-slate-950 p-5 text-white shadow-sm">
      <div className="flex items-center gap-2">
        <Icon name="bot" className="h-5 w-5 text-blue-200" />
        <h2 className="font-bold">Priorità AI</h2>
      </div>
      <div className="mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
        <SeverityBadge tone={topItem?.severity === "critical" ? "danger" : topItem?.severity === "high" ? "warning" : "info"}>
          {topItem ? severityLabel(topItem.severity) : "Nessuna priorita"}
        </SeverityBadge>
        <h3 className="mt-3 text-lg font-bold">{topItem?.title ?? "Nessun alert operativo aperto"}</h3>
        <p className="mt-2 text-sm leading-6 text-blue-100">
          {topItem?.why ?? "Il backend non ha segnalato eventi prioritari per questa vista."}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Critici" value={criticalCount} />
        <Stat label="Da monitorare" value={watchCount} />
        <Stat label="Silenziati" value={silentCount} />
      </div>
    </section>
  );
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Timeline giornaliera</h2>
          <p className="text-sm text-slate-500">Vista cronologica utile per capire causa, sequenza e correlazioni.</p>
        </div>
        <Icon name="clock" className="h-5 w-5 text-slate-500" />
      </div>
      {items.length ? (
        <div className="relative space-y-4 before:absolute before:left-[70px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-200">
          {items.map((item: TimelineItem) => {
          const dotClass =
            item.kind === "critical" ? "bg-red-500" : item.kind === "network" ? "bg-amber-500" : item.kind === "backup" ? "bg-emerald-500" : "bg-blue-500";
          return (
            <div key={`${item.time}-${item.title}`} className="relative grid grid-cols-[58px_1fr] gap-5">
              <div className="text-right text-sm font-bold text-slate-500">{item.time}</div>
              <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className={`absolute -left-[28px] top-5 h-3 w-3 rounded-full ring-4 ring-white ${dotClass}`} />
                <div className="font-semibold text-slate-950">{item.title}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.kind}</div>
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        <EmptyState text="Nessun evento recente disponibile per la timeline." />
      )}
    </Card>
  );
}

export function OverviewPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [overview, setOverview] = useState<OverviewData>({
    modules: [],
    days: [],
    kpiCounters: [],
    kpiPeriodLabel: "Periodo corrente",
    sourcePipeline: [],
    timeline: [],
    severityDistribution: [],
    inboxItems: [],
  });
  const [apiSource, setApiSource] = useState<"api" | "error">("api");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    securityCenterApi.getOverview()
      .then((result) => {
        if (!active) return;
        setOverview(result.data);
        setApiSource(result.source);
      })
      .catch(() => {
        if (!active) return;
        setApiSource("error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-950">Cruscotto KPI</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${apiSource === "api" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {apiSource === "api" ? "API live" : "API non disponibile"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Qui guardi lo stato operativo. Per capire cosa sta entrando usa Monitor ingressi; per vedere i contenuti normalizzati usa Report importati.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavButton label="Monitor ingressi" page="inbox" onNavigate={onNavigate} />
            <NavButton label="Report importati" page="reports" onNavigate={onNavigate} />
            <NavButton label="Configurazione" page="configuration" onNavigate={onNavigate} />
          </div>
        </div>
      </div>
      {loading ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Caricamento cruscotto...</div> : null}
      {!loading && apiSource === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Non riesco a caricare i KPI dal backend. Controlla servizio, login e API.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        <WorkflowCard title="1. Configura" detail="Sorgenti, regole, notifiche e silenziamenti." page="configuration" onNavigate={onNavigate} />
        <WorkflowCard title="2. Monitora ingressi" detail="Mailbox, upload, alert e input recenti." page="inbox" onNavigate={onNavigate} />
        <WorkflowCard title="3. Leggi report" detail="Report normalizzati e informazioni estratte." page="reports" onNavigate={onNavigate} />
        <WorkflowCard title="4. Valuta KPI" detail="Trend, priorita e salute pipeline." page="overview" onNavigate={onNavigate} />
      </div>
      {overview.modules.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.modules.map((module) => (
            <ModuleCard key={module.key} item={module} />
          ))}
        </div>
      ) : !loading ? (
        <EmptyPanel title="Nessun modulo operativo disponibile" text="Configura sorgenti e add-on per popolare la copertura moduli." />
      ) : null}
      <KpiDistribution counters={overview.kpiCounters} periodLabel={overview.kpiPeriodLabel} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <DayStrip days={overview.days} />
        <AiPriority items={overview.inboxItems} distribution={overview.severityDistribution} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <EventTable items={overview.inboxItems} compact />
        <Pipeline steps={overview.sourcePipeline} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.55fr]">
        <Timeline items={overview.timeline} />
        <ChartBox title="Rumore filtrato" subtitle="Distribuzione giornaliera alert/watch/silent.">
          <Donut data={overview.severityDistribution} />
          <div className="mt-2 grid gap-2">
            {overview.severityDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold text-slate-950">{item.value}</span>
              </div>
            ))}
          </div>
        </ChartBox>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{text}</div>;
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function formatKpiName(value: string) {
  return value.replace(/[_-]+/g, " ");
}

function NavButton({ label, page, onNavigate }: { label: string; page: PageKey; onNavigate?: (page: PageKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(page)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function WorkflowCard({ title, detail, page, onNavigate }: { title: string; detail: string; page: PageKey; onNavigate?: (page: PageKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(page)}
      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="font-bold text-slate-950">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </button>
  );
}
