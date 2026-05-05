import { useState } from "react";
import { suggestAlertRule, type AISuggestion } from "../../services/aiApi";
import { Icon } from "../common/Icon";

interface ServiceConfigAssistantProps {
  onSuggestionAccepted?: (suggestion: AISuggestion) => void;
  disabled?: boolean;
}

export function ServiceConfigAssistant({ onSuggestionAccepted, disabled = false }: ServiceConfigAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [error, setError] = useState("");
  const [context, setContext] = useState("");

  const handleGenerateSuggestion = async () => {
    if (!context.trim()) {
      setError("Inserisci una descrizione del servizio");
      return;
    }

    setLoading(true);
    setError("");
    setSuggestion(null);

    try {
      const response = await suggestAlertRule(context);
      setSuggestion(response.suggestion);
    } catch (err) {
      setError("Impossibile generare suggerimento");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onSuggestionAccepted?.(suggestion);
      setSuggestion(null);
      setContext("");
    }
  };

  const exampleContexts = [
    "Voglio monitorare i report di sicurezza di WatchGuard Firewall per rilevare accessi non autorizzati",
    "Devo configurare alert per Microsoft Defender quando vengono rilevati malware",
    "Voglio tracciare i backup NAS e ricevere alert se falliscono",
    "Necessito di monitorare i log del server web per rilevare tentativi di intrusione",
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Icon name="bot" className="h-6 w-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-950">Assistente Configurazione Servizi</h3>
            <p className="mt-1 text-sm text-blue-700">
              Descrivi il servizio che vuoi monitorare e l'AI ti suggerirà le regole di alert appropriate.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Descrizione del servizio
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Esempio: Voglio monitorare i report di sicurezza di WatchGuard Firewall per rilevare accessi non autorizzati..."
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={4}
          disabled={loading}
        />
      </div>

      <div>
        <p className="text-xs text-slate-600 mb-2">Esempi:</p>
        <div className="flex flex-wrap gap-2">
          {exampleContexts.map((example, index) => (
            <button
              key={index}
              onClick={() => setContext(example)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerateSuggestion}
        disabled={loading || !context.trim()}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
      >
        {loading ? "Generazione in corso..." : "Genera Suggerimento"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {suggestion && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold text-green-950">Suggerimento AI</h4>
            <button
              onClick={() => setSuggestion(null)}
              className="text-sm text-green-700 hover:text-green-900"
            >
              Chiudi
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nome Regola</label>
              <p className="mt-1 rounded-md bg-white px-3 py-2 text-sm text-slate-900">
                {suggestion.rule_name}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Condizione</label>
              <p className="mt-1 rounded-md bg-white px-3 py-2 text-sm text-slate-900 font-mono">
                {suggestion.condition}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Severità</label>
              <span className={`mt-1 inline-block rounded-full px-3 py-1.5 text-xs font-semibold ${
                suggestion.severity === "critical"
                  ? "bg-red-100 text-red-700"
                  : suggestion.severity === "high"
                  ? "bg-orange-100 text-orange-700"
                  : suggestion.severity === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}>
                {suggestion.severity.toUpperCase()}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Descrizione</label>
              <p className="mt-1 rounded-md bg-white px-3 py-2 text-sm text-slate-600">
                {suggestion.description}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Razionale</label>
              <p className="mt-1 rounded-md bg-white px-3 py-2 text-sm text-slate-600">
                {suggestion.rationale}
              </p>
            </div>

            {suggestion.recommended_actions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Azioni Suggerite</label>
                <ul className="mt-1 list-inside list-disc rounded-md bg-white px-3 py-2 text-sm text-slate-600">
                  {suggestion.recommended_actions.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={disabled}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {disabled ? "Salvataggio in corso..." : "Accetta e Crea Regola"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
