import { useEffect, useState } from "react";
import { AIChat } from "../components/ai/AIChat";
import {
  getAIOperationsSummary,
  AIOperationsSummary,
  AIProviderStatus,
} from "../services/aiApi";

export function AIAssistantPage() {
  const params = new URLSearchParams(window.location.search);
  const [operationsData, setOperationsData] = useState<AIOperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = params.get("page");
  const objectType = params.get("object_type");
  const objectId = params.get("object_id");

  const initialContext = page && objectType && objectId
    ? { object_type: objectType, object_id: objectId }
    : undefined;

  const suggestedQuestions = page === "alert"
    ? [
        "Spiegami questo alert",
        "Qual è la gravità?",
        "Quali evidenze lo supportano?",
        "Quali azioni consigli?",
      ]
    : page === "report"
      ? [
          "Riassumi questo report",
          "Quali KPI importanti emergono?",
          "Ci sono anomalie?",
          "Che alert può generare?",
        ]
      : page === "ticket"
        ? [
            "Spiegami questo ticket",
            "Qual è il piano remediation?",
            "Che priorità ha?",
            "Cosa manca per chiuderlo?",
          ]
        : page === "evidence"
          ? [
              "Riassumi queste evidenze",
              "Che cosa dimostrano?",
              "Quali dati mancano?",
            ]
          : undefined;

  useEffect(() => {
    const loadOperationsData = async () => {
      try {
        const data = await getAIOperationsSummary();
        setOperationsData(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load AI operations data:", err);
        setError("Impossibile caricare i dati operativi AI");
      } finally {
        setLoading(false);
      }
    };

    loadOperationsData();
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

  const getProviderStatusBadge = (status: AIProviderStatus["status"]) => {
    const statusConfig = {
      ok: { className: "bg-emerald-50 text-emerald-700", label: "OK" },
      warning: { className: "bg-amber-50 text-amber-700", label: "Warning" },
      error: { className: "bg-red-50 text-red-700", label: "Error" },
      not_configured: { className: "bg-slate-50 text-slate-700", label: "Non configurato" },
    };
    const config = statusConfig[status];
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getInteractionStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      success: { className: "bg-emerald-50 text-emerald-700", label: "Successo" },
      error: { className: "bg-red-50 text-red-700", label: "Errore" },
      config_error: { className: "bg-red-50 text-red-700", label: "Config Error" },
      provider_error: { className: "bg-red-50 text-red-700", label: "Provider Error" },
    };
    const config = statusConfig[status] || { className: "bg-slate-50 text-slate-700", label: status };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleQuickAction = (action: string) => {
    const quickActionMessages: Record<string, string> = {
      daily_summary: "Genera una sintesi giornaliera delle attività di sicurezza",
      explain_alert: "Spiegami gli alert critici attuali",
      remediation_plan: "Suggerisci un piano di remediation per i ticket aperti",
      summarize_report: "Riassumi i report recenti",
      summarize_evidence: "Riassumi le evidenze raccolte",
    };
    return quickActionMessages[action] || action;
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Caricamento AI Assistant...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">AI Assistant</h1>
          <p className="mt-2 text-sm text-slate-500">
            Console operativa AI per monitorare stato, utilizzo e interazioni.
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Chat con AI</h2>
          </div>
          <div className="h-[600px]">
            <AIChat initialContext={initialContext} suggestedQuestions={suggestedQuestions} />
          </div>
        </div>
      </div>
    );
  }

  if (!operationsData) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">AI Assistant</h1>
          <p className="mt-2 text-sm text-slate-500">
            Console operativa AI per monitorare stato, utilizzo e interazioni.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  const { provider_status, usage_summary, recent_interactions, supported_contexts, quick_actions, safety } = operationsData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-950">AI Assistant</h1>
          <p className="mt-2 text-sm text-slate-500">
            Console operativa AI per monitorare stato, utilizzo e interazioni.
          </p>
        </div>
      </div>

      {/* Context Banner */}
      {initialContext && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">
            Contesto attivo: {objectType} #{objectId}
          </p>
        </div>
      )}

      {/* Provider Not Configured Warning */}
      {provider_status.status === "not_configured" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-700">
            Provider AI non configurato
          </p>
          <p className="mt-1 text-sm text-amber-600">
            Configura NVIDIA_NIM_API_KEY nelle impostazioni per utilizzare le funzionalità AI.
          </p>
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Provider Status Card */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Stato Provider AI</h2>
            {getProviderStatusBadge(provider_status.status)}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Provider</span>
              <span className="text-sm font-semibold text-slate-900">{provider_status.provider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Modello</span>
              <span className="text-sm font-semibold text-slate-900">{provider_status.model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Modello Veloce</span>
              <span className="text-sm font-semibold text-slate-900">{provider_status.fast_model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Configurato</span>
              <span className={`text-sm font-semibold ${provider_status.configured ? "text-emerald-600" : "text-red-600"}`}>
                {provider_status.configured ? "Sì" : "No"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">API Key</span>
              <span className="text-sm font-semibold text-slate-900">{provider_status.api_key_label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Latenza Media</span>
              <span className="text-sm font-semibold text-slate-900">{provider_status.avg_latency_ms}ms</span>
            </div>
            {provider_status.last_success_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Ultimo Successo</span>
                <span className="text-xs text-slate-500">{formatDate(provider_status.last_success_at)}</span>
              </div>
            )}
            {provider_status.last_error_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Ultimo Errore</span>
                <span className="text-xs text-slate-500">{formatDate(provider_status.last_error_at)}</span>
              </div>
            )}
            {provider_status.last_error_message && (
              <div className="mt-2 rounded bg-red-50 p-2">
                <p className="text-xs text-red-700">{provider_status.last_error_message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Usage Summary Card */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Utilizzo AI</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Query Totali</span>
              <span className="text-sm font-semibold text-slate-900">{usage_summary.total_queries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Query Riuscite</span>
              <span className="text-sm font-semibold text-emerald-600">{usage_summary.successful_queries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Query Fallite</span>
              <span className="text-sm font-semibold text-red-600">{usage_summary.failed_queries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Tempo Medio Risposta</span>
              <span className="text-sm font-semibold text-slate-900">{usage_summary.avg_response_time}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Analisi Completate</span>
              <span className="text-sm font-semibold text-slate-900">{usage_summary.analyses_completed}</span>
            </div>
          </div>
        </div>

        {/* Safety and Audit Card */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Sicurezza e Audit</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Redaction</span>
              <span className={`text-sm font-semibold ${safety.redaction_enabled ? "text-emerald-600" : "text-slate-400"}`}>
                {safety.redaction_enabled ? "Attiva" : "Disattiva"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Context Builder</span>
              <span className={`text-sm font-semibold ${safety.context_builder_enabled ? "text-emerald-600" : "text-slate-400"}`}>
                {safety.context_builder_enabled ? "Attivo" : "Disattivo"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Audit Log</span>
              <span className={`text-sm font-semibold ${safety.audit_log_enabled ? "text-emerald-600" : "text-slate-400"}`}>
                {safety.audit_log_enabled ? "Attivo" : "Disattivo"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Prompt Completi</span>
              <span className={`text-sm font-semibold ${safety.stores_full_prompts ? "text-amber-600" : "text-emerald-600"}`}>
                {safety.stores_full_prompts ? "Salvati" : "Non salvati"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Risposte Complete</span>
              <span className={`text-sm font-semibold ${safety.stores_full_responses ? "text-amber-600" : "text-emerald-600"}`}>
                {safety.stores_full_responses ? "Salvate" : "Non salvate"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Contexts and Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Supported Contexts */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Contesti Supportati</h2>
          <div className="space-y-2">
            {supported_contexts.map((context) => (
              <div
                key={context.type}
                className="flex items-center justify-between rounded border border-slate-200 p-3"
              >
                <span className="text-sm font-medium text-slate-900">{context.label}</span>
                <span className={`text-xs font-semibold ${context.enabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {context.enabled ? "Abilitato" : "Disabilitato"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Azioni Rapide</h2>
          <div className="space-y-2">
            {quick_actions.map((action) => (
              <button
                key={action.key}
                onClick={() => {
                  const input = document.querySelector('textarea[placeholder*="Scrivi un messaggio"]') as HTMLTextAreaElement;
                  if (input) {
                    input.value = handleQuickAction(action.key);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                }}
                className="w-full rounded border border-slate-200 bg-slate-50 p-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-100 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Interactions */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-950">Interazioni Recenti</h2>
        {recent_interactions.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna interazione AI registrata</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold text-slate-900">Azione</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900">Stato</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900">Pagina</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900">Modello</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900">Latenza</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent_interactions.map((interaction) => (
                  <tr key={interaction.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{interaction.action}</td>
                    <td className="px-3 py-2">{getInteractionStatusBadge(interaction.status)}</td>
                    <td className="px-3 py-2 text-slate-600">{interaction.page || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{interaction.model}</td>
                    <td className="px-3 py-2 text-slate-600">{interaction.latency_ms}ms</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(interaction.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-950">Chat con AI</h2>
        </div>
        <div className="h-[600px]">
          <AIChat initialContext={initialContext} suggestedQuestions={suggestedQuestions} />
        </div>
      </div>
    </div>
  );
}
