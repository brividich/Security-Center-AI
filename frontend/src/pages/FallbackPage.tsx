import { evidence, rules } from "../data/mockData";
import type { PageKey } from "../types/securityCenter";
import { Card } from "../components/common/Card";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";

interface FallbackPageProps {
  page: PageKey;
}

export function FallbackPage({ page }: FallbackPageProps) {
  if (page === "evidence") {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <h2 className="font-bold text-slate-950">Evidence Container: DEF-CVE-001</h2>
          <p className="mt-1 text-sm text-slate-500">Ogni alert importante conserva sorgente, parsing, decisione e audit trail.</p>
          <div className="mt-5 space-y-3">
            {evidence.map((item, index) => (
              <div key={item.name} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 font-bold text-blue-700">{index + 1}</div>
                  <div>
                    <div className="font-bold text-slate-950">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.meta}</div>
                  </div>
                </div>
                <SeverityBadge tone={item.status === "stored" ? "good" : "warning"}>{item.status}</SeverityBadge>
              </div>
            ))}
          </div>
        </Card>
        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
          <Icon name="file" className="h-6 w-6 text-blue-300" />
          <h3 className="mt-4 text-lg font-bold">Parser output JSON</h3>
          <pre className="mt-4 overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-5 text-slate-200">{`{
  "vendor": "Microsoft Defender",
  "type": "vulnerability_notification",
  "cve": ["CVE-2026-28387", "CVE-2026-31789"],
  "severity": "Critical",
  "cvss": 9.8,
  "exposed_devices": 58,
  "affected_product": "OpenSSL"
}`}</pre>
        </section>
      </div>
    );
  }

  if (page === "rules") {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-bold text-slate-950">Rule Builder anti-rumore</h2>
          <p className="mt-1 text-sm text-slate-500">Le regole decidono cosa diventa alert, cosa resta KPI e cosa viene soppresso.</p>
          <div className="mt-5 space-y-3">
            {rules.map((rule) => (
              <div key={rule.name} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-950">{rule.name}</h3>
                  <SeverityBadge tone={rule.tone}>{rule.result}</SeverityBadge>
                </div>
                <code className="mt-3 block rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">{rule.condition}</code>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold text-slate-950">Silence / Snooze Panel</h2>
          <p className="mt-1 text-sm text-slate-500">Ogni silenziamento richiede motivo, owner, scadenza e audit log.</p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Scope
              <select className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200">
                <option>source=WatchGuard AND severity&lt;=Medium</option>
                <option>asset=f.gentile AND type=VPN_RECONNECT</option>
                <option>source=Synology AND status=Warning</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Durata
              <select className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200">
                <option>24 ore</option>
                <option>7 giorni</option>
                <option>Fino a data</option>
                <option>Regola strutturata</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Motivo obbligatorio
              <textarea
                className="mt-1 min-h-28 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                defaultValue="Segnale noto, monitorato via baseline. Nessuna evidenza persa: contatori e trace restano nel container."
              />
            </label>
            <button className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Crea suppression rule auditata</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-950">Sezione non ancora implementata</h2>
      <p className="mt-1 text-sm text-slate-500">Questa pagina è pronta per essere collegata alla prossima vista production.</p>
    </Card>
  );
}
