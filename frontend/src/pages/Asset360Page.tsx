import { assets } from "../data/mockData";
import { Card } from "../components/common/Card";
import { SeverityBadge } from "../components/common/SeverityBadge";

export function Asset360Page() {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Asset Signals</h2>
          <p className="text-sm text-slate-500">Vista per asset/utente invece che per report sorgente.</p>
        </div>
        <div className="flex gap-2">
          <SeverityBadge tone="danger">1 critical</SeverityBadge>
          <SeverityBadge tone="warning">3 watch</SeverityBadge>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Stato</th>
              <th className="px-4 py-3">Segnale</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Azione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {assets.map((asset) => (
              <tr key={asset.name} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-950">{asset.name}</td>
                <td className="px-4 py-3">
                  <SeverityBadge tone={asset.status === "Critical" ? "danger" : asset.status === "Warning" || asset.status === "Watch" ? "warning" : "good"}>
                    {asset.status}
                  </SeverityBadge>
                </td>
                <td className="px-4 py-3 text-slate-700">{asset.signal}</td>
                <td className="px-4 py-3 text-slate-500">{asset.owner}</td>
                <td className="px-4 py-3">
                  <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Dettaglio</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
