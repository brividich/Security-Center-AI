import { navItems } from "../../data/mockData";
import type { AppShellProps } from "../../types/securityCenter";
import { DesktopNav } from "./DesktopNav";
import { Header } from "./Header";
import { MobileTopBar } from "./MobileTopBar";

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <MobileTopBar navItems={navItems} active={active} onNavigate={onNavigate} />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[92px_1fr]">
        <DesktopNav navItems={navItems} active={active} onNavigate={onNavigate} />
        <main className="min-w-0">
          <Header />
          <div className="p-5 lg:p-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
