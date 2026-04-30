import { useState, useEffect } from "react";
import type { SourcePreset, CreateSourceRequest, ReportSource, UpdateSourceRequest } from "../../types/configuration";
import { fetchSourcePresets, createSource, updateSource, testConfiguration } from "../../services/configurationApi";

interface SourceSetupWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  editingSource?: ReportSource | null;
}

type WizardStep = "preset" | "origin" | "recognition" | "test" | "review";

function buildUpdatePayload(formData: CreateSourceRequest): UpdateSourceRequest {
  const payload: UpdateSourceRequest = {
    name: formData.name,
    enabled: formData.enabled,
    source_type: formData.source_type,
    max_messages_per_run: formData.max_messages_per_run,
    mark_as_read_after_import: formData.mark_as_read_after_import,
    process_attachments: formData.process_attachments,
    process_email_body: formData.process_email_body,
  };

  const optionalTextFields: Array<keyof UpdateSourceRequest> = [
    "mailbox_address",
    "description",
    "sender_allowlist_text",
    "subject_include_text",
    "subject_exclude_text",
    "body_include_text",
    "attachment_extensions",
  ];

  optionalTextFields.forEach((field) => {
    const value = formData[field as keyof CreateSourceRequest];
    if (typeof value === "string" && value.trim()) {
      (payload as Record<string, string | number | boolean | undefined>)[field] = value;
    }
  });

  return payload;
}

export default function SourceSetupWizard({ onClose, onSuccess, editingSource }: SourceSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(editingSource ? "origin" : "preset");
  const [presets, setPresets] = useState<SourcePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<SourcePreset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const [formData, setFormData] = useState<CreateSourceRequest>({
    name: editingSource?.name || "",
    code: editingSource?.id || "",
    enabled: editingSource?.enabled ?? editingSource?.status !== "disabled",
    source_type: editingSource?.sourceType || "manual",
    mailbox_address: "",
    description: "",
    sender_allowlist_text: "",
    subject_include_text: "",
    subject_exclude_text: "",
    body_include_text: "",
    attachment_extensions: editingSource?.attachmentExtensions || "",
    max_messages_per_run: editingSource?.maxMessagesPerRun || 50,
    mark_as_read_after_import: editingSource?.markAsReadAfterImport ?? false,
    process_attachments: editingSource?.processAttachments ?? true,
    process_email_body: editingSource?.processEmailBody ?? true,
  });

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const data = await fetchSourcePresets();
      setPresets(data);
    } catch (err) {
      setError("Impossibile caricare i preset");
    }
  };

  const handlePresetSelect = (preset: SourcePreset) => {
    setSelectedPreset(preset);
    setFormData({
      ...formData,
      name: preset.default_name,
      code: `${preset.code_prefix}-${Date.now()}`,
      source_type: preset.source_type,
      sender_allowlist_text: preset.sender_allowlist_text,
      subject_include_text: preset.subject_include_text,
      subject_exclude_text: preset.subject_exclude_text,
      body_include_text: preset.body_include_text,
      attachment_extensions: preset.attachment_extensions,
      max_messages_per_run: preset.max_messages_per_run,
      mark_as_read_after_import: preset.mark_as_read_after_import,
      process_attachments: preset.process_attachments,
      process_email_body: preset.process_email_body,
    });
    setCurrentStep("origin");
  };

  const handleNext = () => {
    const steps: WizardStep[] = ["preset", "origin", "recognition", "test", "review"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = ["preset", "origin", "recognition", "test", "review"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleTestConfig = async (sampleText: string, filename: string) => {
    try {
      setLoading(true);
      const result = await testConfiguration({
        sample_text: sampleText,
        filename: filename,
      });
      setTestResult(result);
    } catch (err) {
      setError("Test fallito");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      if (editingSource) {
        await updateSource(editingSource.id, buildUpdatePayload(formData));
      } else {
        await createSource(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Errore durante il salvataggio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingSource ? "Modifica sorgente report" : "Aggiungi report da seguire"}
          </h2>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200 px-6 py-4">
          <div className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${currentStep === "preset" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>1. Tipo</div>
          <div className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${currentStep === "origin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>2. Origine</div>
          <div className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${currentStep === "recognition" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>3. Riconoscimento</div>
          <div className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${currentStep === "test" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>4. Test</div>
          <div className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${currentStep === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>5. Riepilogo</div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          {currentStep === "preset" && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Seleziona tipo di report</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {presets.map((preset) => (
                  <div
                    key={preset.preset_code}
                    className="cursor-pointer rounded-xl border-2 border-slate-200 p-4 transition hover:border-blue-500 hover:bg-blue-50"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    <h4 className="mb-2 font-semibold text-slate-900">{preset.title}</h4>
                    <p className="mb-2 text-sm text-slate-600">{preset.description}</p>
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{preset.module}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === "origin" && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Configura origine</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nome sorgente</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Codice (slug)</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    disabled={Boolean(editingSource)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tipo origine</label>
                  <select
                    value={formData.source_type}
                    onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="manual">Upload/manuale</option>
                    <option value="graph">Microsoft Graph</option>
                  </select>
                </div>
                {formData.source_type === "graph" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                    <div className="font-semibold">Microsoft Graph legge mailbox Microsoft 365.</div>
                    <div className="mt-1">
                      Inserisci qui solo la mailbox e i filtri. Tenant, app registration e credenziali restano nella pagina Microsoft Graph.
                    </div>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Indirizzo mailbox (opzionale)</label>
                  <input
                    type="email"
                    value={formData.mailbox_address}
                    onChange={(e) => setFormData({ ...formData, mailbox_address: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {editingSource && (
                    <p className="mt-1 text-xs font-medium text-slate-500">Lascia vuoto per mantenere la mailbox gia salvata.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Descrizione</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === "recognition" && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Riconoscimento email/report</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mittenti consentiti (uno per riga)</label>
                  <textarea
                    value={formData.sender_allowlist_text}
                    onChange={(e) => setFormData({ ...formData, sender_allowlist_text: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Oggetto deve contenere</label>
                  <textarea
                    value={formData.subject_include_text}
                    onChange={(e) => setFormData({ ...formData, subject_include_text: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Oggetto deve escludere</label>
                  <textarea
                    value={formData.subject_exclude_text}
                    onChange={(e) => setFormData({ ...formData, subject_exclude_text: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Estensioni allegati (es: pdf,html)</label>
                  <input
                    type="text"
                    value={formData.attachment_extensions}
                    onChange={(e) => setFormData({ ...formData, attachment_extensions: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="process_attachments"
                    checked={formData.process_attachments}
                    onChange={(e) => setFormData({ ...formData, process_attachments: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="process_attachments" className="text-sm font-medium text-slate-700">Processa allegati</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="process_email_body"
                    checked={formData.process_email_body}
                    onChange={(e) => setFormData({ ...formData, process_email_body: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="process_email_body" className="text-sm font-medium text-slate-700">Processa corpo email</label>
                </div>
              </div>
            </div>
          )}

          {currentStep === "test" && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Test configurazione</h3>
              <p className="mb-4 text-sm text-slate-600">Incolla un testo di esempio per verificare il parser</p>
              <textarea
                placeholder="Incolla qui il testo del report..."
                rows={8}
                onChange={(e) => {
                  if (e.target.value.length > 100) {
                    handleTestConfig(e.target.value, "test.txt");
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {testResult && (
                <div className="mt-4 rounded-lg bg-slate-50 p-4">
                  <p className="mb-2 text-sm"><strong>Parser rilevato:</strong> {testResult.parser_detected}</p>
                  <p className="mb-2 text-sm"><strong>Confidenza:</strong> {(testResult.confidence * 100).toFixed(0)}%</p>
                  <p className="mb-2 text-sm"><strong>Genererebbe alert:</strong> {testResult.would_generate_alert ? "Sì" : "No"}</p>
                  {testResult.warnings.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {testResult.warnings.map((w: string, i: number) => (
                        <div key={i} className="text-sm text-yellow-700">{w}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === "review" && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Riepilogo</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Nome:</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formData.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Codice:</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formData.code}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Tipo origine:</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formData.source_type}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Mittenti consentiti:</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formData.sender_allowlist_text || "Nessuno"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Filtri oggetto:</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formData.subject_include_text || "Nessuno"}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          {currentStep !== "preset" && (
            <button onClick={handleBack} disabled={loading} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              Indietro
            </button>
          )}
          {currentStep === "preset" && <div />}
          {currentStep !== "review" && (
            <button onClick={handleNext} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Avanti
            </button>
          )}
          {currentStep === "review" && (
            <button onClick={handleSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
              {loading ? "Salvataggio..." : "Salva"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
