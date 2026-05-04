import { useMemo, useState, type FormEvent } from "react";
import { navItems } from "../../data/navigation";
import type { AppShellProps, NavItem, PageKey } from "../../types/securityCenter";
import { Icon } from "../common/Icon";

const navGroups: Array<{ key: NavItem["section"]; label: string }> = [
  { key: "operations", label: "Operations" },
  { key: "control", label: "Control" },
  { key: "analysis", label: "Analysis" },
];

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const activeItem = navItems.find((item) => item.key === active || (item.key === "modules" && active.startsWith("module-")));
  const searchOptions = useMemo(
    () =>
      navItems.map((item) => ({
        page: item.key,
        label: item.label,
        haystack: `${item.label} ${item.description} ${item.key}`.toLowerCase(),
      })),
    [],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const match =
      searchOptions.find((item) => item.label.toLowerCase() === normalized) ??
      searchOptions.find((item) => item.haystack.includes(normalized));
    if (!match) return;
    onNavigate(match.page);
    setQuery("");
  }

  return (
    <div className="app" data-sidebar={collapsed ? "collapsed" : "expanded"}>
      <aside className="sb">
        <div className="sb-head">
          <BrandMark />
          <div className="sb-brand">
            Security Center
            <small>AI console</small>
          </div>
          <button className="sb-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Espandi" : "Comprimi"}>
            <Icon name="chevron" className={`h-4 w-4 ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>

        <nav className="sb-nav" aria-label="Navigazione principale">
          {navGroups.map((group) => (
            <div className="sb-cat" key={group.key}>
              <div className="sb-cat-btn">
                <span className="sb-cat-label">{group.label}</span>
              </div>
              <div className="sb-cat-items">
                {navItems
                  .filter((item) => item.section === group.key)
                  .map((item) => (
                    <NavButton key={item.key} item={item} active={active} onNavigate={onNavigate} />
                  ))}
              </div>
            </div>
          ))}
        </nav>

        <button className="sb-search" type="button" onClick={() => onNavigate("reports")}>
          <span className="sb-search-ic">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <span className="sb-search-t">
            <span className="sb-search-tt">Cerca</span>
            <span className="sb-search-ts">Alert, host, report, regole</span>
          </span>
        </button>

        <div className="sb-foot">
          <div className="sb-user">
            <div className="sb-av">SO</div>
            <div className="sb-user-meta">
              <div className="sb-u-name">Operatore sicurezza</div>
              <div className="sb-u-role">Example Company</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <form className="tb-search" onSubmit={handleSearch}>
            <Icon name="search" className="h-4 w-4" />
            <input
              aria-label="Cerca nella console"
              list="security-center-search-targets"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cerca in ${activeItem?.label ?? "Security Center AI"}...`}
            />
            <datalist id="security-center-search-targets">
              {searchOptions.map((item) => (
                <option key={item.page} value={item.label} />
              ))}
            </datalist>
          </form>
          <div className="tb-spacer" />
          <span className="tb-pill">
            <span className="dot" />
            Operativo
          </span>
          <button className="tb-icon-btn" type="button" title="Aggiorna dashboard" onClick={() => window.location.reload()}>
            <Icon name="clock" className="h-4 w-4" />
          </button>
          <button className="tb-icon-btn" type="button" title="Alert" onClick={() => onNavigate("alerts")}>
            <Icon name="alert" className="h-4 w-4" />
          </button>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="sb-mark" title="Security Center AI">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.5-3 7.2-7 8.4-4-1.2-7-3.9-7-8.4V6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 12l2.2 2.2L15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function NavButton({ item, active, onNavigate }: { item: NavItem; active: PageKey; onNavigate: (page: PageKey) => void }) {
  const isActive = active === item.key || (item.key === "modules" && active.startsWith("module-"));
  const badge = item.key === "alerts" ? "!" : null;
  const dot = item.key === "services";

  return (
    <button
      type="button"
      className={`sb-item ${isActive ? "active" : ""}`}
      onClick={() => onNavigate(item.key)}
      title={item.label}
    >
      <span className="sb-item-ico">
        <Icon name={item.icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="sb-item-label">{item.label}</span>
      {badge ? <span className="sb-item-badge">{badge}</span> : null}
      {dot ? <span className="sb-item-dot" /> : null}
    </button>
  );
}
