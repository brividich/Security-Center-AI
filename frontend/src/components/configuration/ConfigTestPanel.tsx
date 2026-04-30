import { useState } from "react";
import { Icon } from "../common/Icon";
import { testConfiguration } from "../../services/configurationApi";

interface TestResult {
  parserDetected: string;
  metricsExtracted: number;
  wouldGenerateAlert: boolean;
  evidenceContainer: boolean;
  ticket: boolean;
  warnings: string[];
}

export function ConfigTestPanel() {
  const [sourceType, setSourceType] = useState("watchguard_epdr");
  const [sampleText, setSampleText] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceTypes = [
    { value: "watchguard_epdr", label: "WatchGuard EPDR" },
    { value: "watchguard_threatsync", label: "WatchGuard ThreatSync" },
    { value: "watchguard_dimension", label: "WatchGuard Dimension" },
    { value: "microsoft_defender", label: "Microsoft Defender" },
    { value: "synology_backup", label: "NAS / Synology Backup" },
  ];

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await testConfiguration({
        source_type: sourceType,
        sample_text: sampleText,
      });
      setTestResult({
        parserDetected: result.parser_name || result.parser_detected,
        metricsExtracted: result.metrics_preview.length,
        wouldGenerateAlert: result.would_generate_alert,
        evidenceContainer: result.would_create_evidence_container,
        ticket: result.would_create_ticket,
        warnings: [...result.warnings, ...result.errors],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test configurazione non riuscito");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Test configurazione</h2>
      <p className="mb-6 text-sm text-slate-600">
        Verifica parser, metriche estratte e alert generati usando il backend Security Center AI.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tipo sorgente</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {sourceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Testo campione report</label>
          <textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder="Usa un esempio sanitizzato, senza dati operativi reali."
            rows={6}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleTest}
          disabled={loading || sampleText.trim().length === 0}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Icon name="search" className="h-4 w-4" />
          {loading ? "Test in corso..." : "Esegui test"}
        </button>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {testResult && (
          <div className="mt-6 space-y-4 rounded-lg bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Risultato backend</h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Parser rilevato:</span>
                <span className="font-medium text-slate-900">{testResult.parserDetected}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Metriche estratte:</span>
                <span className="font-medium text-slate-900">{testResult.metricsExtracted}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Genererebbe alert:</span>
                {testResult.wouldGenerateAlert ? (
                  <span className="flex items-center gap-1 font-medium text-red-600">
                    <Icon name="alert" className="h-4 w-4" />
                    Si
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-green-600">
                    <Icon name="check" className="h-4 w-4" />
                    No
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Evidence Container:</span>
                {testResult.evidenceContainer ? (
                  <span className="flex items-center gap-1 font-medium text-blue-600">
                    <Icon name="check" className="h-4 w-4" />
                    Si
                  </span>
                ) : (
                  <span className="font-medium text-slate-400">No</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Ticket di remediation:</span>
                {testResult.ticket ? (
                  <span className="flex items-center gap-1 font-medium text-blue-600">
                    <Icon name="check" className="h-4 w-4" />
                    Si
                  </span>
                ) : (
                  <span className="font-medium text-slate-400">No</span>
                )}
              </div>
            </div>

            {testResult.warnings.length > 0 && (
              <div className="mt-4 rounded-lg bg-yellow-50 p-3">
                <h4 className="mb-2 text-sm font-semibold text-yellow-900">Avvisi</h4>
                <ul className="space-y-1">
                  {testResult.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-yellow-800">
                      <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
