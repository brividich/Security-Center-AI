import type { ReportItem } from "../../types/securityCenter";
import { SeverityBadge } from "../common/SeverityBadge";

interface ReportsTableProps {
  reports: ReportItem[];
}

export function ReportsTable({ reports }: ReportsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Report</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Metriche</th>
            <th className="px-4 py-3">Alert</th>
            <th className="px-4 py-3">Ricevuto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {reports.map((report) => (
            <tr key={report.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{report.name}</td>
              <td className="px-4 py-3 text-slate-700">{report.source}</td>
              <td className="px-4 py-3">
                <SeverityBadge tone={report.status === "Processed" ? "good" : report.status === "Pending" ? "warning" : "info"}>{report.status}</SeverityBadge>
              </td>
              <td className="px-4 py-3 text-slate-500">{report.metrics}</td>
              <td className="px-4 py-3 text-slate-500">{report.alerts}</td>
              <td className="px-4 py-3 text-slate-500">{report.receivedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
