import { Icon } from "../common/Icon";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/80 px-5 py-4 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            <span>Security Center AI</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Console SOC leggera</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Operations Control Room</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <Icon name="calendar" className="h-4 w-4 text-blue-700" /> 26/04/2026
          </div>
          <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            Ultimi 7 giorni
          </button>
          <button className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
            Confronta baseline
          </button>
        </div>
      </div>
    </header>
  );
}
