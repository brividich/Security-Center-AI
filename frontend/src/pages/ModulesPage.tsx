import { useEffect, useState } from "react";
import { ModuleCard } from "../components/modules/ModuleCard";
import { fetchModuleWorkspaces } from "../services/moduleWorkspaceApi";
import type { ModuleWorkspaceData, ModuleWorkspaceTab } from "../types/modules";
import type { PageKey } from "../types/securityCenter";

interface ModulesPageProps {
  onNavigate: (page: PageKey, tab?: ModuleWorkspaceTab) => void;
}

export function ModulesPage({ onNavigate }: ModulesPageProps) {
  const [workspaces, setWorkspaces] = useState<ModuleWorkspaceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    fetchModuleWorkspaces()
      .then((result) => {
        if (!active) return;
        setWorkspaces(result);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Impossibile caricare i moduli.");
        setWorkspaces([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Moduli</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Navigazione per dominio operativo: apri WatchGuard, Microsoft Defender, Backup / NAS o sorgenti custom senza perdere lo Studio Configurazione.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {loadError && <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">Errore caricamento</span>}
        </div>
      </div>

      {loading ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
          Caricamento moduli backend...
        </section>
      ) : loadError ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="font-bold text-red-800">Non riesco a caricare i moduli.</h2>
          <p className="mt-2 text-sm leading-6 text-red-700">{loadError}</p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            onClick={() => window.location.reload()}
          >
            Riprova
          </button>
        </section>
      ) : workspaces.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-950">Nessun modulo disponibile.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Apri la configurazione e aggiungi almeno una sorgente monitorata.</p>
          <button
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            onClick={() => onNavigate("configuration")}
          >
            Vai alla configurazione
          </button>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {workspaces.map((workspace) => (
            <ModuleCard
              key={workspace.definition.key}
              module={workspace}
              onOpen={() => onNavigate(workspace.definition.pageKey)}
              onConfigure={() => onNavigate("configuration")}
              onViewAlerts={() => onNavigate(workspace.definition.pageKey, "alerts")}
              onDiagnostics={() => onNavigate(workspace.definition.pageKey, "diagnostics")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
