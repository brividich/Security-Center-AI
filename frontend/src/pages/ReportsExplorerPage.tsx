import { reports, sourcePipeline } from "../data/mockData";
import { Card } from "../components/common/Card";
import { Icon } from "../components/common/Icon";
import { ReportsTable } from "../components/tables/ReportsTable";

export function ReportsExplorerPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-950">Reports Explorer</h2>
            <p className="text-sm text-slate-500">Report sorgenti normalizzati e pronti per KPI, alert ed evidence.</p>
          </div>
          <Icon name="file" className="h-5 w-5 text-slate-500" />
        </div>
        <ReportsTable reports={reports} />
      </Card>
      <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Ingestion pipeline</h2>
            <p className="text-sm text-slate-400">Stato dell'elaborazione mock per sorgenti mail/upload.</p>
          </div>
          <Icon name="mail" className="h-5 w-5 text-blue-300" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {sourcePipeline.map((step) => (
            <div key={step.name} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
              <div className="text-2xl font-bold">{step.value}</div>
              <div className="mt-1 text-sm font-semibold text-white">{step.name}</div>
              <div className="text-xs text-slate-400">{step.detail}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
