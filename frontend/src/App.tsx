import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { PageKey } from "./types/securityCenter";
import { AddonsPage } from "./pages/AddonsPage";
import { Asset360Page } from "./pages/Asset360Page";
import { ConfigurationStudioPage } from "./pages/ConfigurationStudioPage";
import { EventInboxPage } from "./pages/EventInboxPage";
import { FallbackPage } from "./pages/FallbackPage";
import { ModuleWorkspacePage } from "./pages/ModuleWorkspacePage";
import { ModulesPage } from "./pages/ModulesPage";
import { MicrosoftGraphPage } from "./pages/MicrosoftGraphPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportsExplorerPage } from "./pages/ReportsExplorerPage";
import type { ModuleWorkspaceTab } from "./types/modules";
import { pageKeyForPath, pathForPageKey } from "./utils/moduleAggregation";

function pageFromLocation(): PageKey {
  const modulePage = pageKeyForPath(window.location.pathname);
  if (modulePage) return modulePage;
  const mapping: Record<string, PageKey> = {
    "/": "overview",
    "/addons": "addons",
    "/integrations/microsoft-graph": "microsoft-graph",
    "/inbox": "inbox",
    "/assets": "assets",
    "/reports": "reports",
    "/evidence": "evidence",
    "/rules": "rules",
    "/configuration": "configuration",
  };
  return mapping[window.location.pathname.replace(/\/+$/, "") || "/"] ?? "overview";
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>(() => pageFromLocation());

  useEffect(() => {
    const onPopState = () => setActivePage(pageFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (page: PageKey, tab?: ModuleWorkspaceTab) => {
    setActivePage(page);
    const nextPath = pathForPageKey(page, tab);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  };

  const content = useMemo(() => {
    switch (activePage) {
      case "addons":
        return <AddonsPage />;
      case "microsoft-graph":
        return <MicrosoftGraphPage />;
      case "modules":
        return <ModulesPage onNavigate={navigate} />;
      case "module-watchguard":
      case "module-microsoft-defender":
      case "module-backup-nas":
      case "module-custom":
        return <ModuleWorkspacePage page={activePage} onNavigate={navigate} />;
      case "inbox":
        return <EventInboxPage onNavigate={navigate} />;
      case "assets":
        return <Asset360Page />;
      case "reports":
        return <ReportsExplorerPage onNavigate={navigate} />;
      case "configuration":
        return <ConfigurationStudioPage onNavigate={navigate} />;
      case "rules":
        return <ConfigurationStudioPage defaultTab="rules" onNavigate={navigate} />;
      case "evidence":
        return <FallbackPage page={activePage} />;
      case "overview":
      default:
        return <OverviewPage onNavigate={navigate} />;
    }
  }, [activePage]);

  return (
    <AppShell active={activePage} onNavigate={navigate}>
      {content}
    </AppShell>
  );
}
