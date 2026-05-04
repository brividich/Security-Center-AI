import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { PageKey } from "./types/securityCenter";
import { securityCenterApi } from "./services/api";
import { AddonsPage } from "./pages/AddonsPage";
import { AlertLifecyclePage } from "./pages/AlertLifecyclePage";
import { Asset360Page } from "./pages/Asset360Page";
import { ConfigurationStudioPage } from "./pages/ConfigurationStudioPage";
import { EventInboxPage } from "./pages/EventInboxPage";
import { EvidencePage } from "./pages/EvidencePage";
import { GroupsPage } from "./pages/GroupsPage";
import { LoginPage } from "./pages/LoginPage";
import { ModuleWorkspacePage } from "./pages/ModuleWorkspacePage";
import { ModulesPage } from "./pages/ModulesPage";
import { MicrosoftGraphPage } from "./pages/MicrosoftGraphPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportsExplorerPage } from "./pages/ReportsExplorerPage";
import { ServicesPage } from "./pages/ServicesPage";
import { UsersPage } from "./pages/UsersPage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import type { ModuleWorkspaceTab } from "./types/modules";
import { pageKeyForPath, pathForPageKey } from "./utils/moduleAggregation";

function pageFromLocation(): PageKey {
  const modulePage = pageKeyForPath(window.location.pathname);
  if (modulePage) return modulePage;
  const normalized = window.location.pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/login") {
    return "login" as PageKey;
  }
  if (normalized === "/users") {
    return "admin-users" as PageKey;
  }
  if (normalized === "/groups") {
    return "admin-groups" as PageKey;
  }
  if (normalized === "/alerts" || /^\/alerts\/[^/]+$/.test(normalized) || normalized === "/security/alerts" || /^\/security\/alerts\/[^/]+$/.test(normalized)) {
    return "alerts";
  }
  const mapping: Record<string, PageKey> = {
    "/": "overview",
    "/addons": "addons",
    "/integrations/microsoft-graph": "microsoft-graph",
    "/inbox": "inbox",
    "/alerts": "alerts",
    "/assets": "assets",
    "/reports": "reports",
    "/services": "services",
    "/evidence": "evidence",
    "/rules": "rules",
    "/configuration": "configuration",
    "/users": "users",
    "/groups": "groups",
    "/ai": "ai",
  };
  return mapping[normalized] ?? "overview";
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>(() => pageFromLocation());
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canViewSecurity, setCanViewSecurity] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await securityCenterApi.checkSession();
        setIsAuthenticated(session.authenticated);
        setCanViewSecurity(session.can_view_security);
      } catch {
        setIsAuthenticated(false);
        setCanViewSecurity(false);
      } finally {
        setSessionChecked(true);
      }
    };
    checkAuth();
  }, []);

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
      case "login":
        return <LoginPage />;
      case "admin-users":
        return <UsersPage />;
      case "admin-groups":
        return <GroupsPage />;
      case "users":
        return <UsersPage />;
      case "groups":
        return <GroupsPage />;
      case "ai":
        return <AIAssistantPage />;
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
      case "alerts":
        return <AlertLifecyclePage onNavigate={navigate} />;
      case "assets":
        return <Asset360Page onNavigate={navigate} />;
      case "reports":
        return <ReportsExplorerPage onNavigate={navigate} />;
      case "services":
        return <ServicesPage onNavigate={navigate} />;
      case "configuration":
        return <ConfigurationStudioPage onNavigate={navigate} />;
      case "rules":
        return <ConfigurationStudioPage defaultTab="rules" onNavigate={navigate} />;
      case "evidence":
        return <EvidencePage onNavigate={navigate} />;
      case "overview":
      default:
        return <OverviewPage onNavigate={navigate} />;
    }
  }, [activePage]);

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 mx-auto" />
          <div className="text-sm text-slate-600">Verifica sessione...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !canViewSecurity) {
    if (activePage === "login") {
      return <LoginPage />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mb-4 text-4xl">🔐</div>
          <h1 className="mb-2 text-xl font-bold text-amber-900">Login richiesto</h1>
          <p className="mb-4 text-sm text-amber-800">
            {isAuthenticated
              ? "Non hai i permessi necessari per accedere al Security Center."
              : "Devi accedere al sistema per visualizzare il Security Center."}
          </p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
          >
            Vai al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <AppShell active={activePage} onNavigate={navigate}>
      {content}
    </AppShell>
  );
}
