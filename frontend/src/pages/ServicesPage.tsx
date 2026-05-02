import type { PageKey } from "../types/securityCenter";
import { Icon } from "../components/common/Icon";
import { MailboxIngestionServicePanel } from "../components/services/MailboxIngestionServicePanel";

export function ServicesPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Icon name="clock" className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Servizi</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Stato operativo del polling Graph/mailbox, ultime importazioni e comandi manuali di controllo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.("configuration")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Icon name="settings" className="h-4 w-4" />
              Configurazione
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("microsoft-graph")}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              <Icon name="network" className="h-4 w-4" />
              Microsoft Graph
            </button>
          </div>
        </div>
      </section>

      <MailboxIngestionServicePanel onConfigure={() => onNavigate?.("configuration")} />
    </div>
  );
}
