import type { NotificationChannel } from "../../types/configuration";
import { Icon } from "../common/Icon";

interface NotificationChannelCardProps {
  channel: NotificationChannel;
}

export function NotificationChannelCard({ channel }: NotificationChannelCardProps) {
  const typeConfig = {
    dashboard: { label: "Cruscotto", icon: "shield" as const },
    email: { label: "Email", icon: "mail" as const },
    teams: { label: "Teams", icon: "network" as const },
    ticket: { label: "Ticket", icon: "file" as const },
    webhook_future: { label: "Webhook", icon: "network" as const },
  };
  const type = typeConfig[channel.type] ?? { label: String(channel.type || "Canale"), icon: "network" as const };
  const deliveryDate = channel.lastDelivery ? new Date(channel.lastDelivery) : null;
  const deliveryLabel = deliveryDate && !Number.isNaN(deliveryDate.getTime())
    ? deliveryDate.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "Mai";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Icon name={type.icon} className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{channel.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{type.label}</p>
          </div>
        </div>
        {channel.enabled ? (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            <Icon name="check" className="h-3 w-3" />
            Attivo
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">Disattivo</span>
        )}
      </div>

      <div className="mb-3 space-y-2 text-sm">
        <div>
          <span className="text-slate-500">Destinazione:</span>
          <span className="ml-2 font-medium text-slate-900">{channel.destination}</span>
        </div>
        <div>
          <span className="text-slate-500">Ultima consegna:</span>
          <span className="ml-2 font-medium text-slate-900">{deliveryLabel}</span>
        </div>
      </div>

      {channel.errorState && (
        <div className="mb-3 rounded-lg bg-red-50 p-3">
          <div className="flex items-start gap-2 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{channel.errorState}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
          <Icon name="eye" className="h-4 w-4" />
          Stato visibile in console
        </span>
        <a className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200" href="/configuration?tab=notifications">
          <Icon name="clock" className="h-4 w-4" />
          Aggiorna vista
        </a>
      </div>
    </div>
  );
}
