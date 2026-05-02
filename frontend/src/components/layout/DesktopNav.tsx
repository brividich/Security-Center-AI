import type { NavItem, PageKey } from "../../types/securityCenter";
import { Icon } from "../common/Icon";

interface DesktopNavProps {
  navItems: NavItem[];
  active: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function DesktopNav({ navItems, active, onNavigate }: DesktopNavProps) {
  const groups = [
    { key: "operations", label: "Operativita" },
    { key: "control", label: "Gestione" },
    { key: "analysis", label: "Analisi" },
  ] as const;

  return (
    <aside className="hidden border-r border-slate-200 bg-slate-950 px-3 py-4 text-white lg:flex lg:flex-col">
      <div className="mb-5 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-950 shadow-sm">
          <Icon name="shield" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold">Security Center AI</div>
          <div className="truncate text-xs text-slate-400">Console operativa</div>
        </div>
      </div>
      <nav className="space-y-4" aria-label="Navigazione principale">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mb-1 px-2 text-[11px] font-bold uppercase text-slate-500">{group.label}</div>
            <div className="space-y-1">
              {navItems
                .filter((item) => item.section === group.key)
                .map((item) => (
                  <NavButton key={item.key} item={item} active={active} onNavigate={onNavigate} />
                ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
        <div className="font-bold text-slate-200">Percorso operativo</div>
        <div className="mt-2 grid gap-1">
          <QuickButton label="Configura" page="configuration" onNavigate={onNavigate} />
          <QuickButton label="Servizi" page="services" onNavigate={onNavigate} />
          <QuickButton label="Monitora ingressi" page="inbox" onNavigate={onNavigate} />
          <QuickButton label="Leggi report" page="reports" onNavigate={onNavigate} />
        </div>
      </div>
    </aside>
  );
}

function QuickButton({ label, page, onNavigate }: { label: string; page: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      className="rounded-md px-2 py-1.5 text-left font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
    >
      {label}
    </button>
  );
}

function NavButton({ item, active, onNavigate }: { item: NavItem; active: PageKey; onNavigate: (page: PageKey) => void }) {
  const isActive = active === item.key || (item.key === "modules" && active.startsWith("module-"));
  return (
    <button
      onClick={() => onNavigate(item.key)}
      title={item.label}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
        isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon name={item.icon} className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{item.label}</span>
        <span className={`block truncate text-[11px] ${isActive ? "text-blue-100" : "text-slate-500"}`}>{item.description}</span>
      </span>
    </button>
  );
}
