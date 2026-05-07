/* Dashboard-specific SOC components */

import React from "react";
import Icons from "./Icons";
import { Sparkline as SparklineChart } from "./Charts";
import { Badge, Avatar, Button, IconButton, Row, Col, Grow, Muted, Faint, Eyebrow } from "./UI";

export interface KpiTileProps {
  label: string;
  num: string;
  delta: string;
  trend: "up" | "down" | "flat";
  tone: "critical" | "ok" | "cyan" | "medium";
  data: number[];
}

export function KpiTile({ label, num, delta, trend, tone, data }: KpiTileProps) {
  const toneVar =
    tone === "critical"
      ? "var(--critical)"
      : tone === "ok"
        ? "var(--ok)"
        : tone === "cyan"
          ? "var(--cyan)"
          : "var(--medium)";

  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <div className="soc-stat">
      <div className="soc-stat-label">
        <span style={{ width: 6, height: 6, borderRadius: 999, background: toneVar }} />
        {label}
      </div>
      <div className="soc-stat-num">{num}</div>
      <div className="soc-stat-foot">
        <span
          className={
            trend === "down" && tone === "ok"
              ? "up"
              : trend === "up" && tone === "critical"
                ? "dn"
                : ""
          }
        >
          {arrow} {delta}
        </span>
        <span style={{ color: toneVar }}>
          <SparklineChart data={data} width={70} height={22} color={toneVar} />
        </span>
      </div>
    </div>
  );
}

export interface LegendDotProps {
  color: string;
  label: string;
}

export function LegendDot({ color, label }: LegendDotProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-mid)", fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

export interface DistRowProps {
  color: string;
  label: string;
  value: number;
  pct: string;
}

export function DistRow({ color, label, value, pct }: DistRowProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 8, alignItems: "center" }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span className="soc-mono" style={{ fontSize: 13, fontWeight: 700 }}>
        {value}
      </span>
      <span className="soc-mono" style={{ fontSize: 11, color: "var(--text-light)", width: 36, textAlign: "right" }}>
        {pct}
      </span>
    </div>
  );
}

export interface PipelineStageProps {
  label: string;
  sub: string;
  n: string;
  tone: "ok" | "warn" | "err";
  warn?: number;
  last?: boolean;
}

export function PipelineStage({ label, sub, n, tone, warn, last }: PipelineStageProps) {
  const bgColor = tone === "ok" ? "var(--ok-bg)" : tone === "warn" ? "var(--medium-bg)" : "var(--critical-bg)";
  const textColor = tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--medium)" : "var(--critical)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: bgColor,
          color: textColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {Icons.check({ size: 14 })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-light)", fontWeight: 600 }}>{sub}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="soc-mono" style={{ fontSize: 11, fontWeight: 700 }}>
          {n}
        </div>
        {warn && (
          <div style={{ fontSize: 9.5, color: "var(--medium)", fontWeight: 700, marginTop: 1 }}>
            {warn} retry
          </div>
        )}
      </div>
    </div>
  );
}

export interface SourceRowProps {
  icon: (props: { size?: number }) => React.ReactNode;
  name: string;
  type: string;
  n: number;
  data: number[];
  tone: "accent" | "ok" | "cyan";
  status: "ok" | "warn" | "err";
  trendDown?: boolean;
}

export function SourceRow({ icon, name, type, n, data, tone, status, trendDown }: SourceRowProps) {
  const sparkClass = tone === "accent" ? "accent" : tone === "ok" ? "ok" : "cyan";

  return (
    <tr>
      <td>
        <Row gap={8}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "var(--surface-3)",
              color: "var(--text-mid)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon({ size: 14 })}
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{name}</div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-light)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              {type}
            </div>
          </div>
        </Row>
      </td>
      <td className="num soc-mono" style={{ fontWeight: 700 }}>
        {n}
      </td>
      <td>
        <div className={`soc-spark ${sparkClass}`} style={{ height: 22 }}>
          {data.map((v, i) => (
            <span
              key={i}
              style={{ height: Math.max(2, (v / Math.max(...data)) * 22) }}
            />
          ))}
        </div>
      </td>
      <td>
        {status === "ok" && <Badge severity="ok">OK</Badge>}
        {status === "warn" && <Badge severity="medium">Warn</Badge>}
        {status === "err" && <Badge severity="critical">Err</Badge>}
      </td>
    </tr>
  );
}

export interface AICopilotCardProps {
  summary?: string;
  suggestions?: { icon: (props: { size?: number }) => React.ReactNode; text: string; sev: "crit" | "med" }[];
}

export function AICopilotCard({ summary, suggestions }: AICopilotCardProps) {
  const defaultSummary =
    "Cluster anomalo di <b>3 alert critici</b> sul segmento OT (10.12.4.0/24): probabile movimento laterale dopo l'iniezione su <span className='soc-mono' style='color:var(--critical)'>SRV-MES-04</span>. Suggerito isolamento switch port e raccolta forense.";

  const defaultSuggestions = [
    { icon: Icons.bolt, text: "Isola SRV-MES-04 (WatchGuard policy)", sev: "crit" as const },
    { icon: Icons.fileText, text: "Apri evidence container · 4 host correlati", sev: "med" as const },
    { icon: Icons.users, text: "Notifica turno notte · escalation L3", sev: "med" as const },
  ];

  return (
    <div
      className="soc-card"
      style={{
        background: "linear-gradient(135deg, rgba(30,167,255,.08), rgba(255,107,0,.06) 80%)",
        borderColor: "var(--low-mid)",
      }}
    >
      <div className="soc-card-h" style={{ borderColor: "var(--low-mid)" }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "linear-gradient(135deg, var(--cyan-bright), var(--cyan))",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Icons.sparkles({ size: 14 })}
        </span>
        <h3>AI Copilot · sintesi</h3>
        <div className="grow" />
        <Badge severity="low">llama 3.1 70b</Badge>
      </div>
      <div className="soc-card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p
          style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "var(--text)" }}
          dangerouslySetInnerHTML={{ __html: summary || defaultSummary }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(suggestions || defaultSuggestions).map((s, i) => (
            <AISuggestion key={i} icon={s.icon} text={s.text} sev={s.sev} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <span className="ic" style={{ color: "var(--text-mid)" }}>
            {Icons.send({ size: 14 })}
          </span>
          <input
            className="soc-input"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              height: 20,
              padding: 0,
              fontSize: 12,
            }}
            placeholder="Chiedi all'AI sul cruscotto…"
          />
          <span className="soc-kbd">⏎</span>
        </div>
      </div>
    </div>
  );
}

export interface AISuggestionProps {
  icon: (props: { size?: number }) => React.ReactNode;
  text: string;
  sev: "crit" | "med";
}

export function AISuggestion({ icon, text, sev }: AISuggestionProps) {
  const color = sev === "crit" ? "var(--critical)" : "var(--medium)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 7,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      <span style={{ color }}>{icon({ size: 13 })}</span>
      <span style={{ flex: 1 }}>{text}</span>
      <Button variant="ghost" size="sm">
        esegui
      </Button>
    </div>
  );
}
