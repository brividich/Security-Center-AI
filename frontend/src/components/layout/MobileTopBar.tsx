import type { NavItem, PageKey } from "../../types/securityCenter";
import { Icon } from "../common/Icon";

interface MobileTopBarProps {
  navItems: NavItem[];
  active: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function MobileTopBar({ navItems, active, onNavigate }: MobileTopBarProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white lg:hidden">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white text-blue-950">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          Security Center AI
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${
              active === item.key ? "bg-blue-600 text-white" : "bg-white/10 text-slate-300"
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
