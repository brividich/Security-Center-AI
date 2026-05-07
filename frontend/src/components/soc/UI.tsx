/* SOC UI Components — Stat, Badge, Button, Avatar, etc. */

import React from "react";
import Icons from "./Icons";

export interface StatProps {
  label: string;
  num: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  tone?: "critical" | "high" | "medium" | "low" | "ok" | "cyan";
  data?: number[];
}

export function Stat({ label, num, delta, trend = "flat", tone = "ok", data }: StatProps) {
  const toneVar =
    tone === "critical"
      ? "var(--critical)"
      : tone === "ok"
        ? "var(--ok)"
        : tone === "cyan"
          ? "var(--cyan)"
          : tone === "medium"
            ? "var(--medium)"
            : "var(--text)";

  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <div className="soc-stat">
      <div className="soc-stat-label">
        <span style={{ width: 6, height: 6, borderRadius: 999, background: toneVar }} />
        {label}
      </div>
      <div className="soc-stat-num">{num}</div>
      {delta && (
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
          {data && (
            <span style={{ color: toneVar }}>
              <Sparkline data={data} width={70} height={22} color={toneVar} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 70, height = 22, color }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <div className="soc-spark" style={{ height, width }}>
      {data.map((v, i) => (
        <span
          key={i}
          style={{
            height: Math.max(2, ((v - min) / range) * height),
            background: color || "var(--text-faint)",
          }}
        />
      ))}
    </div>
  );
}

export interface BadgeProps {
  severity?: "critical" | "high" | "medium" | "low" | "ok" | "mute";
  children: React.ReactNode;
}

export function Badge({ severity = "mute", children }: BadgeProps) {
  const sevClass = severity === "critical" ? "crit" : severity === "high" ? "high" : severity === "medium" ? "med" : severity === "low" ? "low" : severity === "ok" ? "ok" : "mute";

  return <span className={`soc-sev ${sevClass}`}>{children}</span>;
}

export interface TagProps {
  variant?: "default" | "accent" | "cyan";
  children: React.ReactNode;
}

export function Tag({ variant = "default", children }: TagProps) {
  const variantClass = variant === "accent" ? "accent" : variant === "cyan" ? "cyan" : "";

  return <span className={`soc-tag ${variantClass}`}>{children}</span>;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "cyan" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({ variant = "default", size = "md", icon, children, className = "", ...props }: ButtonProps) {
  const variantClass = variant === "primary" ? "primary" : variant === "cyan" ? "cyan" : variant === "ghost" ? "ghost" : variant === "danger" ? "danger" : "";
  const sizeClass = size === "sm" ? "sm" : size === "lg" ? "lg" : "";

  return (
    <button className={`soc-btn ${variantClass} ${sizeClass} ${className}`} {...props}>
      {icon && <span className="ic">{icon}</span>}
      {children}
    </button>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  bordered?: boolean;
}

export function IconButton({ icon, bordered = false, className = "", ...props }: IconButtonProps) {
  return (
    <button className={`soc-iconbtn ${bordered ? "bordered" : ""} ${className}`} {...props}>
      {icon}
    </button>
  );
}

export interface AvatarProps {
  initials?: string;
  size?: number;
  src?: string;
}

export function Avatar({ initials = "??", size = 20, src }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: "var(--accent)",
        color: "#fff",
        fontWeight: 800,
        fontSize: size * 0.4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials}
    </div>
  );
}

export interface CardProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  style?: React.CSSProperties;
}

export function Card({ header, children, flush = false, style }: CardProps) {
  return (
    <div className="soc-card" style={style}>
      {header && <div className="soc-card-h">{header}</div>}
      <div className={`soc-card-b ${flush ? "flush" : ""}`}>{children}</div>
    </div>
  );
}

export interface RowMarkerProps {
  severity?: "critical" | "high" | "medium" | "low" | "ok";
  style?: React.CSSProperties;
}

export function RowMarker({ severity = "medium", style }: RowMarkerProps) {
  const sevClass = severity === "critical" ? "crit" : severity === "high" ? "high" : severity === "medium" ? "med" : severity === "low" ? "low" : "ok";

  return <div className={`soc-row-mark ${sevClass}`} style={style} />;
}

export interface KbdProps {
  children: React.ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return <span className="soc-kbd">{children}</span>;
}

export interface DotSeparatorProps {
  className?: string;
}

export function DotSeparator({ className = "" }: DotSeparatorProps) {
  return <span className={`soc-dot-sep ${className}`} />;
}

export interface DividerProps {
  className?: string;
}

export function Divider({ className = "" }: DividerProps) {
  return <div className={`soc-divider ${className}`} />;
}

export interface EyebrowProps {
  children: React.ReactNode;
}

export function Eyebrow({ children }: EyebrowProps) {
  return <div className="soc-eyebrow">{children}</div>;
}

export interface MutedProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Muted({ children, style }: MutedProps) {
  return <span className="soc-muted" style={style}>{children}</span>;
}

export interface FaintProps {
  children: React.ReactNode;
}

export function Faint({ children }: FaintProps) {
  return <span className="soc-faint">{children}</span>;
}

export interface RowProps {
  children: React.ReactNode;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Row({ children, gap = 8, className = "", style }: RowProps) {
  return (
    <div className={`soc-row ${className}`} style={{ gap, ...style }}>
      {children}
    </div>
  );
}

export interface ColProps {
  children: React.ReactNode;
  gap?: number;
  className?: string;
}

export function Col({ children, gap = 8, className = "" }: ColProps) {
  return (
    <div className={`soc-col ${className}`} style={{ gap }}>
      {children}
    </div>
  );
}

export interface GrowProps {
  children: React.ReactNode;
}

export function Grow({ children }: GrowProps) {
  return <div className="soc-grow">{children}</div>;
}
