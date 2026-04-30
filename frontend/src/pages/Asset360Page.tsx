import { Card } from "../components/common/Card";
import { SeverityBadge } from "../components/common/SeverityBadge";

export function Asset360Page() {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Segnali asset</h2>
          <p className="text-sm text-slate-500">Vista per asset/utente invece che per report sorgente.</p>
        </div>
        <div className="flex gap-2">
          <SeverityBadge tone="info">API backend</SeverityBadge>
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Nessun dato asset disponibile dalle API backend.
      </div>
    </Card>
  );
}
