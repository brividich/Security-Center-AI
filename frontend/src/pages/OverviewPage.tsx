import { assets, days, inboxItems, modules, severityDistribution, sourcePipeline, timeline } from "../data/mockData";
import type { ModuleStatus, TimelineItem } from "../types/securityCenter";
import { ChartBox } from "../components/charts/ChartBox";
import { Donut } from "../components/charts/Donut";
import { Card } from "../components/common/Card";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { Stat } from "../components/common/Stat";
import { EventTable } from "../components/tables/EventTable";

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
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">score</div>
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
            <div className="font-bold text-slate-950">{item.title}</div>
            <div className="text-sm text-slate-500">{item.subtitle}</div>
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

function DayStrip() {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Navigazione temporale KPI</h2>
          <p className="text-sm text-slate-500">Scorri per giorno, confronta con media 7/30 giorni o stesso periodo precedente.</p>
        </div>
        <SeverityBadge tone="info">Aprile 2026</SeverityBadge>
      </div>
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
    </Card>
  );
}

function Pipeline() {
  return (
    <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold">Ingestion pipeline</h2>
          <p className="text-sm text-slate-400">Da mailbox/upload a KPI, alert ed evidence container.</p>
        </div>
        <Icon name="mail" className="h-5 w-5 text-blue-300" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sourcePipeline.map((step) => (
          <div key={step.name} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold">{step.value}</div>
            <div className="mt-1 text-sm font-semibold text-white">{step.name}</div>
            <div className="text-xs text-slate-400">{step.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiPriority() {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-blue-900 to-slate-950 p-5 text-white shadow-sm">
      <div className="flex items-center gap-2">
        <Icon name="bot" className="h-5 w-5 text-blue-200" />
        <h2 className="font-bold">Priorità AI</h2>
      </div>
      <div className="mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
        <SeverityBadge tone="danger">Critical</SeverityBadge>
        <h3 className="mt-3 text-lg font-bold">OpenSSL CVE Critical su 58 device</h3>
        <p className="mt-2 text-sm leading-6 text-blue-100">
          L'unico evento realmente critico del giorno. Gli altri segnali sono stati aggregati o soppressi perché low-volume, chiusi o già mitigati.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Critical" value={1} />
        <Stat label="Watch" value={3} />
        <Stat label="Silent" value={42} />
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Timeline giornaliera</h2>
          <p className="text-sm text-slate-500">Vista cronologica utile per capire causa, sequenza e correlazioni.</p>
        </div>
        <Icon name="clock" className="h-5 w-5 text-slate-500" />
      </div>
      <div className="relative space-y-4 before:absolute before:left-[70px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-200">
        {timeline.map((item: TimelineItem) => {
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
    </Card>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <ModuleCard key={module.key} item={module} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <DayStrip />
        <AiPriority />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <EventTable items={inboxItems} compact />
        <Pipeline />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.55fr]">
        <Timeline />
        <ChartBox title="Rumore filtrato" subtitle="Distribuzione giornaliera alert/watch/silent.">
          <Donut data={severityDistribution} />
          <div className="mt-2 grid gap-2">
            {severityDistribution.map((item) => (
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
