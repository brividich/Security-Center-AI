import { useEffect, useState } from "react";
import { AIChat } from "../components/ai/AIChat";

export interface AIAnalysis {
  id: number;
  title: string;
  description: string;
  created_at: string;
  status: "completed" | "in_progress" | "failed";
}

export interface AIUsageMetrics {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  avg_response_time: number;
  analyses_completed: number;
}

export function AIAssistantPage() {
  const [recentAnalyses, setRecentAnalyses] = useState<AIAnalysis[]>([]);
  const [metrics, setMetrics] = useState<AIUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock data for recent analyses
  const mockRecentAnalyses: AIAnalysis[] = [
    {
      id: 1,
      title: "Analisi Report di Sicurezza",
      description: "Analisi dei report di sicurezza degli ultimi 7 giorni",
      created_at: "2026-05-04T10:30:00Z",
      status: "completed",
    },
    {
      id: 2,
      title: "Rilevamento Anomalie Accessi",
      description: "Identificazione di pattern di accesso anomali",
      created_at: "2026-05-04T09:15:00Z",
      status: "completed",
    },
    {
      id: 3,
      title: "Valutazione Rischi Sistema",
      description: "Valutazione completa dei rischi di sicurezza",
      created_at: "2026-05-03T16:45:00Z",
      status: "in_progress",
    },
    {
      id: 4,
      title: "Suggerimenti Configurazione",
      description: "Raccomandazioni per migliorare la configurazione",
      created_at: "2026-05-03T14:20:00Z",
      status: "completed",
    },
  ];

  // Mock data for metrics
  const mockMetrics: AIUsageMetrics = {
    total_queries: 156,
    successful_queries: 148,
    failed_queries: 8,
    avg_response_time: 2.3,
    analyses_completed: 42,
  };

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setRecentAnalyses(mockRecentAnalyses);
      setMetrics(mockMetrics);
      setLoading(false);
    }, 500);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: AIAnalysis["status"]) => {
    const statusConfig = {
      completed: {
        className: "bg-emerald-50 text-emerald-700",
        label: "Completato",
      },
      in_progress: {
        className: "bg-blue-50 text-blue-700",
        label: "In corso",
      },
      failed: {
        className: "bg-red-50 text-red-700",
        label: "Fallito",
      },
    };
    const config = statusConfig[status];
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Caricamento AI Assistant...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-950">AI Assistant</h1>
          <p className="mt-2 text-sm text-slate-500">
            Interagisci con l'assistente AI per analizzare report, rilevare anomalie e ricevere suggerimenti di sicurezza.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chat Area - Takes up 2/3 of the space */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-950">Chat con AI</h2>
            </div>
            <div className="h-[600px]">
              <AIChat />
            </div>
          </div>
        </div>

        {/* Sidebar - Takes up 1/3 of the space */}
        <div className="space-y-6">
          {/* Statistics Section */}
          {metrics && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-950">Statistiche Utilizzo</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Query Totali</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.total_queries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Query Riuscite</span>
                  <span className="text-sm font-semibold text-emerald-600">{metrics.successful_queries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Query Fallite</span>
                  <span className="text-sm font-semibold text-red-600">{metrics.failed_queries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Tempo Medio Risposta</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.avg_response_time}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Analisi Completate</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.analyses_completed}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Analyses Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-950">Analisi Recenti</h2>
            <div className="space-y-3">
              {recentAnalyses.length === 0 ? (
                <p className="text-sm text-slate-500">Nessuna analisi recente.</p>
              ) : (
                recentAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="text-sm font-medium text-slate-900">{analysis.title}</h3>
                      {getStatusBadge(analysis.status)}
                    </div>
                    <p className="mb-2 text-xs text-slate-600">{analysis.description}</p>
                    <p className="text-xs text-slate-500">{formatDate(analysis.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
