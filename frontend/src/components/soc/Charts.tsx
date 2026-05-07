/* SOC Chart Components — Sparkline, Donut, LineChart, Heatmap, GeoMap */

import React from "react";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 120, height = 32, color }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <polyline points={points} stroke={color || "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface DonutProps {
  size?: number;
  thickness?: number;
  label?: string;
  sub?: string;
  segments: { value: number; color: string }[];
}

export function Donut({ size = 120, thickness = 14, label, sub, segments }: DonutProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        {segments.map((seg, i) => {
          const segmentLength = (seg.value / total) * circumference;
          const dashArray = `${segmentLength} ${circumference}`;
          const dashOffset = -offset;

          offset += segmentLength;

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 600 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}

export interface LineChartProps {
  series: { color: string; data: number[]; fill?: boolean }[];
  xLabels: string[];
  width?: number;
  height?: number;
}

export function LineChart({ series, xLabels, width = 760, height = 200 }: LineChartProps) {
  const maxVal = Math.max(...series.flatMap((s) => s.data));
  const minVal = Math.min(...series.flatMap((s) => s.data));
  const range = maxVal - minVal || 1;

  const xStep = width / (xLabels.length - 1);
  const yScale = (v: number) => height - ((v - minVal) / range) * height;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line
          key={p}
          x1={0}
          y1={height * p}
          x2={width}
          y2={height * p}
          stroke="var(--grid-line)"
          strokeWidth={1}
        />
      ))}

      {/* X labels */}
      {xLabels.map((label, i) => (
        <text
          key={i}
          x={i * xStep}
          y={height + 14}
          textAnchor="middle"
          fontSize={10}
          fill="var(--text-light)"
          fontWeight={600}
        >
          {label}
        </text>
      ))}

      {/* Series */}
      {series.map((s, si) => {
        const points = s.data
          .map((v, i) => `${i * xStep},${yScale(v)}`)
          .join(" ");

        const areaPoints = `0,${height} ${points} ${width},${height}`;

        return (
          <g key={si}>
            {s.fill && (
              <polygon
                points={areaPoints}
                fill={s.color}
                fillOpacity={0.15}
                stroke="none"
              />
            )}
            <polyline
              points={points}
              stroke={s.color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

export interface HeatmapProps {
  days?: string[];
  hours?: number;
}

export function Heatmap({ days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"], hours = 24 }: HeatmapProps) {
  const pseudoHeat = (d: number, h: number) => {
    const business = h >= 8 && h <= 19 ? 1 : 0.25;
    const weekend = d >= 5 ? 0.4 : 1;
    const noise = ((d * 13 + h * 7) % 11) / 22 + 0.1;
    return Math.min(1, business * weekend * (0.4 + noise));
  };

  const getColor = (v: number) => {
    if (v > 0.75) return "var(--critical)";
    if (v > 0.5) return "var(--high)";
    if (v > 0.25) return "var(--medium)";
    return "var(--low)";
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "40px repeat(24, 1fr)", gap: 2, alignItems: "center" }}>
        <div />
        {Array.from({ length: hours }, (_, h) => (
          <div
            key={h}
            className="soc-mono"
            style={{ fontSize: 9, color: "var(--text-light)", textAlign: "center" }}
          >
            {h % 4 === 0 ? String(h).padStart(2, "0") : ""}
          </div>
        ))}
        {days.map((d, di) => (
          <React.Fragment key={d}>
            <div className="soc-mono" style={{ fontSize: 10, color: "var(--text-mid)", fontWeight: 700 }}>
              {d}
            </div>
            {Array.from({ length: hours }, (_, h) => {
              const v = pseudoHeat(di, h);
              return (
                <div
                  key={h}
                  style={{
                    height: 14,
                    borderRadius: 2,
                    background: getColor(v),
                    opacity: 0.12 + v * 0.85,
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          fontSize: 10,
          color: "var(--text-light)",
        }}
      >
        <span>basso</span>
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((o, i) => (
          <span
            key={i}
            style={{ width: 14, height: 10, background: "var(--accent)", opacity: o, borderRadius: 2 }}
          />
        ))}
        <span>alto</span>
      </div>
    </div>
  );
}

export interface GeoMapProps {
  height?: number;
  points: { x: number; y: number; r: number; color: string }[];
}

export function GeoMap({ height = 150, points }: GeoMapProps) {
  return (
    <svg width={340} height={height} viewBox="0 0 340 150" style={{ background: "var(--surface-2)", borderRadius: 8 }}>
      {/* Simplified world map outline */}
      <path
        d="M50,70 Q80,50 120,60 T180,55 T240,65 T300,60"
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
      />
      <path
        d="M60,90 Q100,80 140,85 T200,80 T260,85"
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
      />

      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={p.color}
          opacity={0.6}
        />
      ))}
    </svg>
  );
}
