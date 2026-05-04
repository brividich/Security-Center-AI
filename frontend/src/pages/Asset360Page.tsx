import { useEffect, useState } from "react";
import { Icon } from "../components/common/Icon";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { securityCenterApi } from "../services/api";
import type { AssetSignal, PageKey } from "../types/securityCenter";

export function Asset360Page({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [assets, setAssets] = useState<AssetSignal[]>([]);
  const [source, setSource] = useState<"api" | "error">("api");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    securityCenterApi
      .getAssets()
      .then((result) => {
        if (!active) return;
        setAssets(result);
        setSource("api");
      })
      .catch(() => {
        if (!active) return;
        setAssets([]);
        setSource("error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Analysis</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-950">Segnali asset</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${source === "api" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {source === "api" ? "API live" : "API non disponibile"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Vista per host e asset monitorati, con segnali aggregati dal backend e collegamenti al triage operativo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate?.("alerts")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Alert
            </button>
            <button type="button" onClick={() => onNavigate?.("reports")} className="rounded-lg bg-[var(--sc-blue)] px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
              Report importati
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Caricamento asset...</div>
      ) : source === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Non riesco a caricare gli asset dal backend.</div>
      ) : assets.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-950">Nessun asset disponibile</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Gli asset compariranno quando report, eventi o parser collegheranno host e dispositivi ai record normalizzati.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Asset monitorati" value={assets.length} />
            <Metric label="Con owner" value={assets.filter((asset) => asset.owner && asset.owner !== "Non assegnato").length} />
            <Metric label="Da verificare" value={assets.filter((asset) => asset.status !== "Healthy").length} />
          </div>
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_160px_1.2fr_120px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase text-slate-500">
              <span>Asset</span>
              <span>Stato</span>
              <span>Segnale</span>
              <span>Owner</span>
            </div>
            {assets.map((asset) => (
              <div key={asset.name} className="grid grid-cols-[1fr_160px_1.2fr_120px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon name="network" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate font-mono text-sm font-bold text-slate-950">{asset.name}</span>
                </div>
                <SeverityBadge tone={toneForAsset(asset.status)}>{asset.status}</SeverityBadge>
                <span className="truncate text-sm text-slate-600">{asset.signal}</span>
                <span className="truncate text-sm text-slate-500">{asset.owner}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function toneForAsset(status: AssetSignal["status"]) {
  if (status === "Critical") return "danger";
  if (status === "Warning" || status === "Watch") return "warning";
  return "good";
}
