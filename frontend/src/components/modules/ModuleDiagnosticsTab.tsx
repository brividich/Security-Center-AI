import { Icon } from "../common/Icon";
import type { ModuleDiagnosticCheck, ModuleWorkspaceData } from "../../types/modules";

const statusClasses: Record<ModuleDiagnosticCheck["status"], string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
  pending: "bg-slate-100 text-slate-600",
};

const statusLabels: Record<ModuleDiagnosticCheck["status"], string> = {
  ok: "OK",
  warning: "Attenzione",
  error: "Errore",
  pending: "In attesa",
};

export function ModuleDiagnosticsTab({ workspace }: { workspace: ModuleWorkspaceData }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">Diagnostica modulo</h2>
            <p className="mt-1 text-sm text-slate-500">Controlli leggibili dagli operatori, senza esporre payload o segreti.</p>
          </div>
          <Icon name="search" className="h-5 w-5 text-slate-500" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {workspace.diagnostics.map((check) => (
            <div key={check.id} className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-950">{check.label}</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[check.status]}`}>{statusLabels[check.status]}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">Note operative</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Notice text="Gli alert e i report di dettaglio vengono mostrati solo quando arrivano dalle API backend." />
          <Notice text="Microsoft Graph richiede credenziali e permessi salvati lato backend/server." />
          <Notice text="I dati mostrati qui arrivano dalle API configurazione disponibili." />
          <Notice text="Le sorgenti custom devono usare esempi sanitizzati in test e documentazione." />
        </div>
      </section>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-800">
      <Icon name="alert" className="mt-1 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
