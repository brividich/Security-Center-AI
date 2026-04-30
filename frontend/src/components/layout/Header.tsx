import { Icon } from "../common/Icon";
import type { NavItem, PageKey } from "../../types/securityCenter";
import { BackendStatus } from "./BackendStatus";

interface HeaderProps {
  active: PageKey;
  navItems: NavItem[];
  onNavigate: (page: PageKey) => void;
}

export function Header({ active, navItems, onNavigate }: HeaderProps) {
  const activeItem = navItems.find((item) => item.key === active || (item.key === "modules" && active.startsWith("module-")));

  return (
    <header className="border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-blue-700">
            <span>Security Center AI</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">{activeItem?.label ?? "Console operativa"}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{activeItem?.description ?? "Sala controllo operativa"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BackendStatus />
          <button
            onClick={() => onNavigate("configuration")}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            <Icon name="settings" className="h-4 w-4" />
            Configura monitoraggio
          </button>
          <button
            onClick={() => onNavigate("inbox")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Monitor ingressi
          </button>
        </div>
      </div>
    </header>
  );
}
