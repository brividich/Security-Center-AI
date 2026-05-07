/* DashboardPage — SOC Cruscotto KPI Design */

import { useEffect, useMemo, useState } from "react";
import {
  SOCFrame,
  SOCLayout,
  PageHead,
  LineChart,
  Donut,
  Heatmap,
  GeoMap,
  Badge,
  Button,
  IconButton,
  Avatar,
  Card,
  RowMarker,
  Kbd,
  DotSeparator,
  Row,
  Col,
  Grow,
  Muted,
  Faint,
  Eyebrow,
} from "../components/soc";
import {
  KpiTile,
  LegendDot,
  DistRow,
  PipelineStage,
  SourceRow,
  AICopilotCard,
} from "../components/soc/DashboardComponents";
import Icons from "../components/soc/Icons";
import { securityCenterApi } from "../services/api";
import { fetchConfigurationOverview } from "../services/configurationApi";
import type { PageKey, Severity } from "../types/securityCenter";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface DashboardAlert {
  id: string;
  title: string;
  source: string;
  host: string;
  severity: "critical" | "high" | "medium" | "low";
  time: string;
  assigned: string;
  action: string;
}

interface DashboardData {
  activeAlerts: number;
  mttr: string;
  eventsProcessed: string;
  sourcesInError: number;
  assetCoverage: string;
  severitySeries: { color: string; data: number[]; fill: boolean }[];
  severityDist: { value: number; color: string }[];
  alerts: DashboardAlert[];
  apiSource: "api" | "mock";
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_DATA: DashboardData = {
  activeAlerts: 248,
  mttr: "14m",
  eventsProcessed: "84.2k",
  sourcesInError: 2,
  assetCoverage: "96%",
  severitySeries: [
    { color: "var(--critical)", data: [4, 6, 3, 8, 12, 9, 14, 18, 22, 17, 15, 12], fill: true },
    { color: "var(--high)", data: [12, 15, 11, 18, 22, 18, 28, 32, 30, 25, 22, 20], fill: true },
    { color: "var(--medium)", data: [22, 28, 25, 32, 40, 38, 42, 52, 48, 46, 42, 40], fill: true },
  ],
  severityDist: [
    { value: 18, color: "var(--critical)" },
    { value: 64, color: "var(--high)" },
    { value: 102, color: "var(--medium)" },
    { value: 64, color: "var(--low)" },
  ],
  alerts: [
    {
      id: "AL-7841",
      title: "WatchGuard – Lateral movement, host SRV-MES-04",
      source: "WatchGuard Firebox M470",
      host: "SRV-MES-04 · 10.12.4.18",
      severity: "critical",
      time: "2 min",
      assigned: "M. Conti",
      action: "Triage",
    },
    {
      id: "AL-7839",
      title: "Defender – CVE-2025-31200 (CVSS 9.8) Edge",
      source: "Microsoft Defender",
      host: "WS-OFC-112 · L. Bianchi",
      severity: "critical",
      time: "7 min",
      assigned: "unassigned",
      action: "Acknowledge",
    },
    {
      id: "AL-7836",
      title: "VPN – brute force, 41 tentativi denegati / 5 min",
      source: "WatchGuard SSL-VPN",
      host: "203.0.113.41 → portal.novicrom.it",
      severity: "high",
      time: "12 min",
      assigned: "S. Ferri",
      action: "Open",
    },
    {
      id: "AL-7833",
      title: "Backup NAS – job failed, retention quasi violata",
      source: "Veeam Backup",
      host: "NAS-MILANO-02",
      severity: "high",
      time: "21 min",
      assigned: "M. Conti",
      action: "Open",
    },
    {
      id: "AL-7829",
      title: "M365 – impossible travel, account a.rossi@novicrom.it",
      source: "Microsoft Graph · Entra",
      host: "Milano → Manila in 38m",
      severity: "medium",
      time: "34 min",
      assigned: "unassigned",
      action: "Triage",
    },
    {
      id: "AL-7825",
      title: "DLP – upload sensibile a host esterno",
      source: "WatchGuard Endpoint",
      host: "WS-RND-018 · M. Greco",
      severity: "medium",
      time: "48 min",
      assigned: "L. Pavan",
      action: "Acknowledge",
    },
  ],
  apiSource: "mock",
};

const X_LABELS = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [data, setData] = useState<DashboardData>(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    Promise.allSettled([
      securityCenterApi.getOverview(),
      fetchConfigurationOverview(),
    ]).then(([overviewResult, configResult]) => {
      if (!active) return;

      const merged: DashboardData = { ...MOCK_DATA, apiSource: "api" };

      if (overviewResult.status === "fulfilled") {
        const ov = overviewResult.value.data;

        // Update active alerts from overview
        const critCount = Array.isArray(ov.kpiCounters)
          ? ov.kpiCounters.find((k: any) => /critico|critical/i.test(k.label ?? ""))?.value
          : undefined;
        if (typeof critCount === "number") merged.activeAlerts = critCount;

        // Update severity distribution
        if (Array.isArray(ov.severityDistribution) && ov.severityDistribution.length > 0) {
          merged.severityDist = ov.severityDistribution.map(
            (s: { name: string; value: number; color: string }) => ({
              value: s.value,
              color: s.color ?? "var(--text-mid)",
            })
          );
        }

        // Update recent alerts
        if (Array.isArray(ov.inboxItems) && ov.inboxItems.length > 0) {
          merged.alerts = ov.inboxItems.slice(0, 6).map(
            (item: {
              id: string;
              title: string;
              source: string;
              severity: Severity;
              time: string;
            }) => ({
              id: item.id,
              title: item.title,
              source: item.source,
              host: "—",
              severity: item.severity as "critical" | "high" | "medium" | "low",
              time: item.time,
              assigned: "unassigned",
              action: "Triage",
            })
          );
        }
      } else {
        merged.apiSource = "mock";
      }

      if (configResult.status === "fulfilled") {
        const cfg = configResult.value;
        merged.sourcesInError = cfg.active_sources_count ?? merged.sourcesInError;
      }

      setData(merged);
    })
    .catch(() => {
      if (active) setData({ ...MOCK_DATA, apiSource: "mock" });
    })
    .finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  // ── Theme toggle ───────────────────────────────────────────────────────────
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SOCFrame theme={theme} screenLabel="01 Cruscotto KPI">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-slate-500">Caricamento dashboard…</p>
        </div>
      </SOCFrame>
    );
  }

  const totalAlerts = data.severityDist.reduce((sum, s) => sum + s.value, 0);

  return (
    <SOCFrame theme={theme} screenLabel="01 Cruscotto KPI">
      <SOCLayout
        active="overview"
        trail={["Operations", "Cruscotto KPI"]}
        status={{ tone: "ok", label: "Pipeline operativa" }}
        onNavigate={(id) => onNavigate?.(id as PageKey)}
      >
        <PageHead
          eyebrow="Operations · Live"
          title="Cruscotto KPI"
          sub="Stato pipeline ingestion, alert attivi e copertura sorgenti per i moduli WatchGuard, Defender, Microsoft Graph e Backup."
          meta={
            <>
              <Row gap={6}>
                <DotSeparator />
                <span>
                  Ultimo aggiornamento <b className="soc-mono">09:42:18</b>
                </span>
              </Row>
              <Row gap={6}>
                <DotSeparator />
                <span>
                  Finestra: <b>24h</b>
                </span>
              </Row>
              <Row gap={6}>
                <DotSeparator />
                <span>
                  Tenant: <b>novicrom.onmicrosoft.com</b>
                </span>
              </Row>
            </>
          }
          actions={
            <>
              <Button icon={Icons.calendar({ size: 14 })}>24 ore</Button>
              <Button icon={Icons.filter({ size: 14 })}>Filtra</Button>
              <Button variant="primary" icon={Icons.sparkles({ size: 14 })}>
                Riassunto AI
              </Button>
              <IconButton icon={Icons.refresh({ size: 16 })} onClick={() => window.location.reload()} />
              <IconButton icon={Icons.settings({ size: 16 })} onClick={() => onNavigate?.("configuration")} />
              <IconButton icon={Icons.moon({ size: 16 })} onClick={toggleTheme} />
            </>
          }
        />

        {/* KPI ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 14 }}>
          <KpiTile
            label="Alert attivi"
            num={String(data.activeAlerts)}
            delta="+12.4%"
            trend="up"
            tone="critical"
            data={[180, 190, 195, 210, 205, 225, 238, data.activeAlerts]}
          />
          <KpiTile
            label="MTTR mediano"
            num={data.mttr}
            delta="−18%"
            trend="down"
            tone="ok"
            data={[22, 21, 20, 19, 18, 16, 15, 14]}
          />
          <KpiTile
            label="Eventi processati"
            num={data.eventsProcessed}
            delta="+4.1%"
            trend="up"
            tone="cyan"
            data={[55, 58, 62, 68, 72, 78, 82, 84]}
          />
          <KpiTile
            label="Sorgenti in errore"
            num={String(data.sourcesInError)}
            delta="0"
            trend="flat"
            tone="medium"
            data={[1, 2, 3, 2, 2, 3, 2, data.sourcesInError]}
          />
          <KpiTile
            label="Copertura asset"
            num={data.assetCoverage}
            delta="+1.2%"
            trend="up"
            tone="ok"
            data={[92, 93, 94, 94, 95, 95, 96, 96]}
          />
        </div>

        {/* Row: severity timeline + KPI distribution */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
          <Card
            header={
              <>
                <h3>Alert per severità · 24h</h3>
                <span className="soc-card-sub">Asse X = ora UTC+1</span>
                <div className="grow" />
                <LegendDot color="var(--critical)" label="Critico" />
                <LegendDot color="var(--high)" label="Alto" />
                <LegendDot color="var(--medium)" label="Medio" />
                <IconButton icon={Icons.more({ size: 16 })} />
              </>
            }
          >
            <div style={{ padding: "14px 14px 6px" }}>
              <LineChart series={data.severitySeries} xLabels={X_LABELS} height={200} width={760} />
            </div>
            <div
              style={{
                padding: "6px 14px 14px",
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                fontSize: 11,
                color: "var(--text-mid)",
              }}
            >
              <span>
                <b className="soc-mono" style={{ color: "var(--text)" }}>
                  {totalAlerts}
                </b>{" "}
                alert · 24h
              </span>
              <span>
                peak <b className="soc-mono" style={{ color: "var(--critical)" }}>
                  22
                </b>{" "}
                critici @ 14:00
              </span>
              <span>
                auto-soppressi <b className="soc-mono">312</b> (21%)
              </span>
              <span>
                deduplicati <b className="soc-mono">948</b> in 312 incident
              </span>
            </div>
          </Card>

          <Card
            header={
              <>
                <h3>Mix severità · attivi</h3>
                <div className="grow" />
                <IconButton icon={Icons.more({ size: 16 })} />
              </>
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Donut size={120} thickness={14} label={String(totalAlerts)} sub="attivi" segments={data.severityDist} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <DistRow color="var(--critical)" label="Critico" value={data.severityDist[0]?.value ?? 0} pct="7%" />
                <DistRow color="var(--high)" label="Alto" value={data.severityDist[1]?.value ?? 0} pct="26%" />
                <DistRow color="var(--medium)" label="Medio" value={data.severityDist[2]?.value ?? 0} pct="41%" />
                <DistRow color="var(--low)" label="Basso" value={data.severityDist[3]?.value ?? 0} pct="26%" />
              </div>
            </div>
          </Card>
        </div>

        {/* Row: pipeline + sources */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <Card
            header={
              <>
                <h3>Pipeline ingestion</h3>
                <div className="grow" />
                <Badge severity="ok">Healthy</Badge>
              </>
            }
          >
            <div style={{ padding: "6px 0" }}>
              <PipelineStage label="Receive" sub="Mailbox, upload, API" n="1.2k/h" tone="ok" />
              <PipelineStage label="Parse" sub="42 parser, 3 lingue" n="1.18k/h" tone="ok" />
              <PipelineStage label="Normalize" sub="schema unificato v3" n="1.18k/h" tone="ok" warn={2} />
              <PipelineStage label="Rules" sub="312 regole attive" n="92ms p95" tone="ok" />
              <PipelineStage label="Dedupe" sub="312 incident attivi" n="64% match" tone="ok" />
              <PipelineStage label="Notify" sub="email · webhook · Teams" n="0 backlog" tone="ok" last />
            </div>
          </Card>

          <Card
            header={
              <>
                <h3>Top sorgenti · ultima ora</h3>
                <div className="grow" />
                <IconButton icon={Icons.more({ size: 16 })} />
              </>
            }
          >
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Sorgente</th>
                  <th>Eventi</th>
                  <th>Trend</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                <SourceRow
                  icon={Icons.shieldChk}
                  name="WatchGuard Firebox M470"
                  type="syslog"
                  n={412}
                  data={[12, 18, 14, 22, 28, 30, 26, 34]}
                  tone="cyan"
                  status="ok"
                />
                <SourceRow
                  icon={Icons.microsoft}
                  name="Microsoft Defender XDR"
                  type="graph"
                  n={284}
                  data={[8, 12, 10, 14, 18, 16, 20, 22]}
                  tone="cyan"
                  status="ok"
                />
                <SourceRow
                  icon={Icons.mail}
                  name="M365 mailbox · alert@"
                  type="graph mailbox"
                  n={186}
                  data={[4, 6, 8, 10, 12, 14, 16, 18]}
                  tone="accent"
                  status="warn"
                />
                <SourceRow
                  icon={Icons.database}
                  name="Veeam Backup NAS"
                  type="api"
                  n={42}
                  data={[2, 3, 2, 4, 3, 5, 4, 6]}
                  tone="ok"
                  status="ok"
                />
                <SourceRow
                  icon={Icons.network}
                  name="Cisco Meraki MX"
                  type="syslog"
                  n={38}
                  data={[6, 4, 5, 3, 4, 3, 4, 2]}
                  tone="ok"
                  status="ok"
                  trendDown
                />
              </tbody>
            </table>
          </Card>

          <AICopilotCard />
        </div>

        {/* Recent alerts */}
        <Card style={{ marginBottom: 14 }}>
          <div className="soc-card-h">
            <h3>Alert recenti · in attesa di triage</h3>
            <div className="grow" />
            <Row gap={6}>
              <Button size="sm">Tutti</Button>
              <Button
                size="sm"
                style={{ background: "var(--critical-bg)", color: "var(--critical)", borderColor: "var(--critical-mid)" }}
              >
                Critici · {data.alerts.filter((a) => a.severity === "critical").length}
              </Button>
              <Button size="sm">Alti · {data.alerts.filter((a) => a.severity === "high").length}</Button>
              <IconButton icon={Icons.filter({ size: 12 })} />
            </Row>
          </div>
          <table className="soc-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th style={{ width: 90 }}>ID</th>
                <th>Alert</th>
                <th>Sorgente</th>
                <th>Asset / contesto</th>
                <th style={{ width: 90 }}>Apertura</th>
                <th style={{ width: 120 }}>Assegnato</th>
                <th style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.alerts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <RowMarker
                      severity={
                        a.severity === "critical"
                          ? "critical"
                          : a.severity === "high"
                            ? "high"
                            : a.severity === "medium"
                              ? "medium"
                              : "low"
                      }
                      style={{ height: 24, marginLeft: 6 }}
                    />
                  </td>
                  <td className="soc-mono">
                    <a
                      style={{ color: "var(--cyan)", textDecoration: "none", fontWeight: 700 }}
                      onClick={() => onNavigate?.("alerts")}
                    >
                      {a.id}
                    </a>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{a.title}</div>
                  </td>
                  <td>
                    <Muted style={{ fontSize: 11 }}>{a.source}</Muted>
                  </td>
                  <td className="soc-mono" style={{ fontSize: 11, color: "var(--text-mid)" }}>
                    {a.host}
                  </td>
                  <td className="soc-mono" style={{ fontSize: 11, color: "var(--text-mid)" }}>
                    {a.time}
                  </td>
                  <td>
                    {a.assigned === "unassigned" ? (
                      <Badge severity="mute">non assegnato</Badge>
                    ) : (
                      <Row>
                        <Avatar initials={a.assigned.split(" ").map((s) => s[0]).join("")} size={20} />
                        <span style={{ fontSize: 11, marginLeft: 6 }}>{a.assigned}</span>
                      </Row>
                    )}
                  </td>
                  <td>
                    <Row gap={4} style={{ justifyContent: "flex-end" }}>
                      <Button size="sm" variant="primary">
                        {a.action}
                      </Button>
                      <IconButton icon={Icons.chevR({ size: 14 })} />
                    </Row>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Bottom row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <Card
            header={
              <>
                <h3>Heatmap eventi · 7 giorni × ora</h3>
                <span className="soc-card-sub">picchi colorati · saturazione = volume</span>
                <div className="grow" />
              </>
            }
          >
            <Heatmap />
          </Card>

          <Card
            header={
              <>
                <h3>Geo · sorgenti IP block</h3>
                <span className="soc-card-sub">ultimi 60 min</span>
                <div className="grow" />
              </>
            }
          >
            <GeoMap
              height={150}
              points={[
                { x: 80, y: 50, r: 12, color: "var(--critical)" },
                { x: 110, y: 80, r: 10, color: "var(--high)" },
                { x: 200, y: 60, r: 8, color: "var(--medium)" },
                { x: 260, y: 90, r: 14, color: "var(--critical)" },
                { x: 300, y: 110, r: 7, color: "var(--high)" },
                { x: 40, y: 100, r: 6, color: "var(--medium)" },
              ]}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 11 }}>
              <div className="soc-mono">
                <b>RU</b> · 184 hit · <span style={{ color: "var(--critical)" }}>blocked</span>
              </div>
              <div className="soc-mono">
                <b>CN</b> · 142 hit · <span style={{ color: "var(--high)" }}>throttled</span>
              </div>
              <div className="soc-mono">
                <b>BR</b> · 38 hit · <span style={{ color: "var(--medium)" }}>watch</span>
              </div>
              <div className="soc-mono">
                <b>PH</b> · 22 hit · <span style={{ color: "var(--medium)" }}>watch</span>
              </div>
            </div>
          </Card>
        </div>
      </SOCLayout>
    </SOCFrame>
  );
}
