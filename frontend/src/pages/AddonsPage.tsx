import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/common/Icon";
import { securityApi } from "../services/securityApi";
import type { AddonDetail, AddonStatus, AddonSummary } from "../types/security";

function statusClass(status: AddonStatus) {
  switch (status) {
    case "enabled":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "misconfigured":
      return "border-red-200 bg-red-50 text-red-700";
    case "disabled":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "No reports";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
    </div>
  );
}

function AddonCard({ addon, active, onSelect }: { addon: AddonSummary; active: boolean; onSelect: (code: string) => void }) {
  return (
    <button
      onClick={() => onSelect(addon.code)}
      className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md ${
        active ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-slate-950">{addon.name}</div>
          <div className="text-sm text-slate-500">{addon.vendor}</div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass(addon.status)}`}>{addon.status}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{addon.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Parsers" value={`${addon.enabled_parser_count}/${addon.total_parser_count}`} />
        <Metric label="Sources" value={`${addon.enabled_source_count}/${addon.total_source_count}`} />
        <Metric label="Rules" value={`${addon.enabled_rule_count}/${addon.total_rule_count}`} />
        <Metric label="Warnings" value={addon.warning_count} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-md bg-slate-100 px-2 py-2 font-semibold text-slate-700">{addon.open_alert_count} alerts</span>
        <span className="rounded-md bg-red-50 px-2 py-2 font-semibold text-red-700">{addon.critical_alert_count} critical</span>
        <span className="rounded-md bg-blue-50 px-2 py-2 font-semibold text-blue-700">{addon.open_ticket_count} tickets</span>
      </div>
      <div className="mt-3 text-xs text-slate-500">Last report: {formatDate(addon.last_report_at)}</div>
    </button>
  );
}

function LinkBar({ addon }: { addon: AddonSummary }) {
  const links = [
    ["Detail API", addon.links.api_detail],
    ["Config", addon.links.django_config],
    ["Diagnostics", addon.links.django_diagnostics],
    ["Docs", addon.links.django_docs],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([label, href]) => (
        <a key={label} href={href} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          {label}
        </a>
      ))}
    </div>
  );
}

function DetailTable<T>({ title, items, render }: { title: string; items: T[]; render: (item: T, index: number) => JSX.Element }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-2">{items.length ? items.map(render) : <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">No records.</div>}</div>
    </section>
  );
}

function AddonDetailPanel({ addon, loading }: { addon: AddonDetail | null; loading: boolean }) {
  if (loading) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">Loading addon detail...</section>;
  }
  if (!addon) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">Select an addon to inspect its registry detail.</section>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">{addon.name}</h2>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass(addon.status)}`}>{addon.status}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{addon.status_reason}</p>
          </div>
          <LinkBar addon={addon} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Open alerts" value={addon.alerts_summary.open} />
          <Metric label="Critical alerts" value={addon.alerts_summary.critical_open ?? 0} />
          <Metric label="Open tickets" value={addon.tickets_summary.open} />
          <Metric label="Last report" value={formatDate(addon.last_report_at)} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailTable
          title="Sources"
          items={addon.sources}
          render={(source) => (
            <div key={source.name} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{source.name}</div>
              <div className="text-slate-500">{source.vendor || "No vendor"} / {source.source_type} / {source.enabled ? "enabled" : "disabled"}</div>
            </div>
          )}
        />
        <DetailTable
          title="Parsers"
          items={addon.parsers}
          render={(parser) => (
            <div key={parser.parser_name} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{parser.parser_name}</div>
              <div className="text-slate-500">Priority {parser.priority} / {parser.enabled ? "enabled" : "disabled"}</div>
            </div>
          )}
        />
        <DetailTable
          title="Alert Rules"
          items={addon.alert_rules}
          render={(rule) => (
            <div key={rule.code} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{rule.name}</div>
              <div className="text-slate-500">{rule.code} / {rule.severity} / {rule.enabled ? "enabled" : "disabled"}</div>
            </div>
          )}
        />
        <DetailTable
          title="Suppressions affecting this addon"
          items={addon.suppressions}
          render={(suppression) => (
            <div key={suppression.name} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{suppression.name}</div>
              <div className="text-slate-500">{suppression.is_active ? "active" : "inactive"} / hits {suppression.hit_count}</div>
            </div>
          )}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailTable
          title="Last reports"
          items={addon.last_reports}
          render={(report) => (
            <div key={report.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">{report.title}</div>
              <div className="text-slate-500">{report.source} / {report.parser_name} / {formatDate(report.created_at)}</div>
            </div>
          )}
        />
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-bold text-slate-950">Warnings and misconfigurations</h3>
          <div className="mt-3 space-y-2">
            {[...addon.warnings, ...addon.misconfigurations].length ? (
              [...addon.warnings, ...addon.misconfigurations].map((item) => (
                <div key={item} className="rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800">{item}</div>
              ))
            ) : (
              <div className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-700">No warnings or misconfigurations.</div>
            )}
          </div>
          <a href={addon.links.django_docs} className="mt-3 inline-block rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Documentation: {addon.documentation_file}
          </a>
        </section>
      </div>
    </div>
  );
}

export function AddonsPage() {
  const [addons, setAddons] = useState<AddonSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<AddonDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromMock, setFromMock] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    securityApi
      .getAddons()
      .then((result) => {
        if (!active) return;
        setAddons(result.addons);
        setFromMock(result.fromMock);
        setSelectedCode(result.addons[0]?.code ?? null);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load addons.");
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    securityApi
      .getAddonDetail(selectedCode)
      .then((result) => {
        if (!active) return;
        setDetail(result.addon);
        setFromMock((current) => current || result.fromMock);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load addon detail.");
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCode]);

  const selected = useMemo(() => addons.find((addon) => addon.code === selectedCode) ?? null, [addons, selectedCode]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase text-blue-700">
            <Icon name="disk" className="h-4 w-4" />
            Addon Registry
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Modules and source coverage</h1>
        </div>
        {fromMock && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Development mock data</div>}
      </div>

      {loadingList && <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">Loading addons...</section>}
      {error && <section className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-700 shadow-sm">{error}</section>}
      {!loadingList && !error && addons.length === 0 && <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">No addons found.</section>}

      {!loadingList && addons.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <div className="space-y-3">
            {addons.map((addon) => (
              <AddonCard key={addon.code} addon={addon} active={(selected?.code ?? selectedCode) === addon.code} onSelect={setSelectedCode} />
            ))}
          </div>
          <AddonDetailPanel addon={detail} loading={loadingDetail} />
        </div>
      )}
    </div>
  );
}
