import { useState } from "react";
import { suggestAlertRule, type AISuggestion } from "../../services/aiApi";
import { Icon } from "../common/Icon";

interface AISuggestionsProps {
  context: string;
  onAccept: (suggestion: AISuggestion) => void;
}

export function AISuggestions({ context, onAccept }: AISuggestionsProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetSuggestion = async () => {
    if (!context.trim()) {
      setError("Please provide context for the suggestion");
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const response = await suggestAlertRule(context);
      setSuggestion(response.suggestion);
    } catch (err) {
      setError("Failed to get AI suggestion. Please try again.");
      console.error("Error getting AI suggestion:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onAccept(suggestion);
      setSuggestion(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleGetSuggestion}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <Icon name="bot" className="h-4 w-4" />
        {loading ? "Getting suggestion..." : "Get AI Suggestion"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <Icon name="alert" className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 delay-100" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 delay-200" />
            <span className="ml-2">Analyzing context and generating suggestion...</span>
          </div>
        </div>
      )}

      {suggestion && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-slate-900">
                {suggestion.rule_name}
              </h3>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getSeverityColor(
                  suggestion.severity
                )}`}
              >
                {suggestion.severity}
              </span>
            </div>
            <button
              onClick={handleAccept}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Icon name="check" className="h-4 w-4" />
              Accept Suggestion
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="mb-1 text-sm font-medium text-slate-700">Condition</h4>
              <code className="block rounded bg-slate-100 px-3 py-2 text-sm text-slate-800">
                {suggestion.condition}
              </code>
            </div>

            <div>
              <h4 className="mb-1 text-sm font-medium text-slate-700">Description</h4>
              <p className="text-sm text-slate-600">{suggestion.description}</p>
            </div>

            <div>
              <h4 className="mb-1 text-sm font-medium text-slate-700">Rationale</h4>
              <p className="text-sm text-slate-600">{suggestion.rationale}</p>
            </div>

            {suggestion.recommended_actions && suggestion.recommended_actions.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700">Recommended Actions</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                  {suggestion.recommended_actions.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
