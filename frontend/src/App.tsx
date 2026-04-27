import { useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { PageKey } from "./types/securityCenter";
import { Asset360Page } from "./pages/Asset360Page";
import { EventInboxPage } from "./pages/EventInboxPage";
import { FallbackPage } from "./pages/FallbackPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportsExplorerPage } from "./pages/ReportsExplorerPage";

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("overview");

  const content = useMemo(() => {
    switch (activePage) {
      case "inbox":
        return <EventInboxPage />;
      case "assets":
        return <Asset360Page />;
      case "reports":
        return <ReportsExplorerPage />;
      case "evidence":
      case "rules":
        return <FallbackPage page={activePage} />;
      case "overview":
      default:
        return <OverviewPage />;
    }
  }, [activePage]);

  return (
    <AppShell active={activePage} onNavigate={setActivePage}>
      {content}
    </AppShell>
  );
}
