import type { ReportItem } from "../../types/securityCenter";
import { severityLabel } from "../../data/uiLabels";
import { SeverityBadge } from "../common/SeverityBadge";

interface ReportsTableProps {
  reports: ReportItem[];
}

export function ReportsTable({ reports }: ReportsTableProps) {
  const toneForStatus = (status: ReportItem["status"]) => {
    if (status === "Processed") return "good";
    if (status === "Failed") return "danger";
    if (status === "Pending") return "warning";
    return "info";
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      {reports.length === 0 ? (
        <div className="bg-slate-50 p-5 text-sm text-slate-500">
          Nessun report o input normalizzato disponibile.
        </div>
      ) : (
        <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Report</th>
            <th className="px-4 py-3">Sorgente</th>
            <th className="px-4 py-3">Stato</th>
            <th className="px-4 py-3">Metriche</th>
            <th className="px-4 py-3">Alert</th>
            <th className="px-4 py-3">Ricevuto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {reports.map((report) => (
            <tr key={report.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">{kindLabel(report.kind)}</td>
              <td className="px-4 py-3 font-semibold text-slate-950">{report.name}</td>
              <td className="px-4 py-3 text-slate-700">{report.source}</td>
              <td className="px-4 py-3">
                <SeverityBadge tone={toneForStatus(report.status)}>{severityLabel(report.status)}</SeverityBadge>
              </td>
              <td className="px-4 py-3 text-slate-500">{report.metrics}</td>
              <td className="px-4 py-3 text-slate-500">{report.alerts}</td>
              <td className="px-4 py-3 text-slate-500">{report.receivedAt}</td>
            </tr>
          ))}
        </tbody>
        </table>
      )}
    </div>
  );
}

function kindLabel(kind: ReportItem["kind"]) {
  if (kind === "mailbox") return "Mailbox";
  if (kind === "file") return "File";
  return "Report";
}
