/* SOC Layout Components — Frame, Layout, Sidebar, Topbar, PageHead */

import React from "react";
import Icons from "./Icons";

export interface SOCFrameProps {
  theme?: "light" | "dark";
  children: React.ReactNode;
  screenLabel?: string;
}

export function SOCFrame({ theme = "light", children, screenLabel }: SOCFrameProps) {
  return (
    <div className="soc-frame" data-soc-theme={theme} data-screen-label={screenLabel}>
      {children}
    </div>
  );
}

export interface SOCSidebarProps {
  active?: string;
  compact?: boolean;
  onNavigate?: (id: string) => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactNode;
  badge?: number;
  dot?: boolean;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

export function SOCSidebar({ active = "overview", compact = false, onNavigate }: SOCSidebarProps) {
  const sections: SidebarSection[] = [
    {
      label: "Operations",
      items: [
        { id: "overview", label: "Cruscotto KPI", icon: Icons.shieldChk },
        { id: "alerts", label: "Alert", icon: Icons.alert, badge: 12 },
        { id: "inbox", label: "Monitor ingressi", icon: Icons.inbox },
        { id: "reports", label: "Report importati", icon: Icons.fileText },
        { id: "services", label: "Servizi", icon: Icons.clock },
      ],
    },
    {
      label: "Analisi",
      items: [
        { id: "assets", label: "Segnali asset", icon: Icons.network },
        { id: "rules", label: "Regole", icon: Icons.silence },
        { id: "evidence", label: "Evidenze", icon: Icons.archive },
      ],
    },
    {
      label: "Controllo",
      items: [
        { id: "config", label: "Configurazione", icon: Icons.settings },
        { id: "graph", label: "Microsoft Graph", icon: Icons.microsoft },
        { id: "ai", label: "AI Assistant", icon: Icons.sparkles, dot: true },
      ],
    },
  ];

  return (
    <aside className="soc-sb">
      <div className="soc-sb-head">
        <div className="soc-sb-mark">
          <div className="soc-sb-mark-cn">CN</div>
          <div>
            <div className="soc-sb-mark-name">SECURITY CENTER</div>
            <div className="soc-sb-mark-sub">Novicrom · AI</div>
          </div>
        </div>
      </div>

      <div className="soc-sb-search">
        <span className="ic">{Icons.search({ size: 14 })}</span>
        <input placeholder="Cerca alert, host, CVE…" readOnly />
        <span className="kbd">⌘K</span>
      </div>

      <nav className="soc-sb-nav">
        {sections.map((s, si) => (
          <div key={si} className="soc-sb-sec">
            <div className="soc-sb-sec-l">{s.label}</div>
            {s.items.map((it) => (
              <button
                key={it.id}
                className={`soc-sb-it ${active === it.id ? "active" : ""}`}
                onClick={() => onNavigate?.(it.id)}
              >
                <span className="ic">{it.icon({ size: 16 })}</span>
                <span className="lbl">{it.label}</span>
                {it.badge && <span className="badge">{it.badge}</span>}
                {it.dot && <span className="dot" />}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="soc-sb-foot">
        <div className="soc-sb-pipe">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="eyebrow">Pipeline</span>
            <span className="soc-sev ok" style={{ height: 16, padding: "0 6px", fontSize: 9 }}>
              healthy
            </span>
          </div>
          <div className="soc-sb-pipe-grid">
            <div>
              <div className="n">98.7%</div>
              <div className="l">uptime 7d</div>
            </div>
            <div>
              <div className="n">2.4k</div>
              <div className="l">eventi/h</div>
            </div>
          </div>
        </div>
        <div className="soc-sb-user">
          <div className="av">MC</div>
          <div className="meta">
            <div className="n">M. Conti</div>
            <div className="r">SOC Analyst · L2</div>
          </div>
          <span className="ic">{Icons.logout({ size: 14 })}</span>
        </div>
      </div>
    </aside>
  );
}

export interface SOCTopbarProps {
  trail?: string[];
  title?: string;
  sub?: string;
  actions?: React.ReactNode;
  status?: { tone: "ok" | "warn" | "crit"; label: string };
}

export function SOCTopbar({ trail, status }: SOCTopbarProps) {
  return (
    <header className="soc-tb">
      {trail && (
        <div className="soc-tb-trail">
          {trail.map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="sep">›</span>}
              <span className={i === trail.length - 1 ? "cur" : ""}>{t}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="soc-tb-spacer" />
      {status && (
        <div className="soc-tb-status">
          <span className={`pulse ${status.tone}`} />
          <span className="lbl">{status.label}</span>
        </div>
      )}
      <div className="soc-tb-time soc-mono">
        <span className="muted">UTC+1 ·</span> 09:42:18 · 06 Mag 2026
      </div>
      <button className="soc-iconbtn">{Icons.refresh({ size: 16 })}</button>
      <button className="soc-iconbtn" style={{ position: "relative" }}>
        {Icons.bell({ size: 16 })}
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: 999,
            background: "var(--accent)",
          }}
        />
      </button>
      <button className="soc-iconbtn">{Icons.settings({ size: 16 })}</button>
    </header>
  );
}

export interface PageHeadProps {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export function PageHead({ eyebrow, title, sub, actions, meta }: PageHeadProps) {
  return (
    <div className="soc-ph">
      <div className="soc-ph-l">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="soc-ph-t">{title}</h1>
        {sub && <p className="soc-ph-s">{sub}</p>}
        {meta && <div className="soc-ph-meta">{meta}</div>}
      </div>
      {actions && <div className="soc-ph-a">{actions}</div>}
    </div>
  );
}

export interface SOCLayoutProps {
  active?: string;
  trail?: string[];
  status?: { tone: "ok" | "warn" | "crit"; label: string };
  children: React.ReactNode;
  onNavigate?: (id: string) => void;
}

export function SOCLayout({ active = "overview", trail, status, children, onNavigate }: SOCLayoutProps) {
  return (
    <div className="soc-layout">
      <SOCSidebar active={active} onNavigate={onNavigate} />
      <div className="soc-main">
        <SOCTopbar trail={trail} status={status} />
        <div className="soc-content soc-content-bg">
          <div className="soc-content-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
