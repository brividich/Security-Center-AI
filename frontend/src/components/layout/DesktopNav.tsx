import type { NavItem, PageKey } from "../../types/securityCenter";
import { Icon } from "../common/Icon";

interface DesktopNavProps {
  navItems: NavItem[];
  active: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function DesktopNav({ navItems, active, onNavigate }: DesktopNavProps) {
  return (
    <aside className="hidden border-r border-slate-200 bg-slate-950 px-3 py-5 text-white lg:block">
      <div className="mx-auto mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-950 shadow-sm">
        <Icon name="shield" className="h-7 w-7" />
      </div>
      <nav className="space-y-2" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            title={item.label}
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              active === item.key ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
          </button>
        ))}
      </nav>
    </aside>
  );
}
