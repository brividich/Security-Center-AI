import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../components/common/Icon";
import {
  createSource,
  fetchConfigurationSources,
  fetchGraphSettings,
  runSourceIngestion,
  saveGraphSettings,
  updateSource,
  type GraphSettingsStatus,
} from "../services/configurationApi";
import type { ReportSource, UpdateSourceRequest } from "../types/configuration";

interface GraphFormState {
  name: string;
  code: string;
  mailbox_address: string;
  sender_allowlist_text: string;
  subject_include_text: string;
  body_include_text: string;
  max_messages_per_run: number;
  mark_as_read_after_import: boolean;
}

const initialForm: GraphFormState = {
  name: "Microsoft Graph - Mailbox Security",
  code: "microsoft-graph-mailbox",
  mailbox_address: "security@example.local",
  sender_allowlist_text: "no-reply@microsoft.com\nalerts@microsoft.com",
  subject_include_text: "Defender\nvulnerability\nCVE-",
  body_include_text: "Microsoft Defender\nvulnerability",
  max_messages_per_run: 100,
  mark_as_read_after_import: false,
};

function buildGraphUpdatePayload(form: GraphFormState): UpdateSourceRequest {
  const payload: UpdateSourceRequest = {
    name: form.name,
    source_type: "graph",
    max_messages_per_run: form.max_messages_per_run,
    mark_as_read_after_import: form.mark_as_read_after_import,
    process_attachments: false,
    process_email_body: true,
  };

  if (form.mailbox_address.trim()) {
    payload.mailbox_address = form.mailbox_address.trim();
  }
  if (form.sender_allowlist_text.trim()) {
    payload.sender_allowlist_text = form.sender_allowlist_text;
  }
  if (form.subject_include_text.trim()) {
    payload.subject_include_text = form.subject_include_text;
  }
  if (form.body_include_text.trim()) {
    payload.body_include_text = form.body_include_text;
  }

  return payload;
}

export function MicrosoftGraphPage() {
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [graphSettings, setGraphSettings] = useState<GraphSettingsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<GraphFormState>(initialForm);
  const [settingsForm, setSettingsForm] = useState({
    tenant_id: "",
    client_id: "",
    client_secret: "",
    mail_folder: "Inbox",
  });

  const graphSources = useMemo(
    () => sources.filter((source) => source.sourceType === "graph" || source.originType === "graph"),
    [sources],
  );

  const loadSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceData, settingsData] = await Promise.all([
        fetchConfigurationSources(),
        fetchGraphSettings(),
      ]);
      setSources(sourceData);
      setGraphSettings(settingsData);
      setSettingsForm((current) => ({
        ...current,
        mail_folder: settingsData.mail_folder || "Inbox",
      }));
    } catch (err: any) {
      setError(err?.message || "API configurazione non disponibile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const updateForm = <K extends keyof GraphFormState>(key: K, value: GraphFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleEditSource = (source: ReportSource) => {
    setEditingSourceId(source.id);
    setMessage(null);
    setError(null);
    setForm({
      name: source.name,
      code: source.id,
      mailbox_address: "",
      sender_allowlist_text: "",
      subject_include_text: "",
      body_include_text: "",
      max_messages_per_run: source.maxMessagesPerRun || 100,
      mark_as_read_after_import: source.markAsReadAfterImport ?? false,
    });
  };

  const handleCancelEdit = () => {
    setEditingSourceId(null);
    setForm(initialForm);
  };

  const handleSaveSource = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editingSourceId) {
        await updateSource(editingSourceId, buildGraphUpdatePayload(form));
        setMessage("Sorgente Microsoft Graph aggiornata.");
      } else {
        await createSource({
          name: form.name,
          code: form.code,
          enabled: true,
          source_type: "graph",
          mailbox_address: form.mailbox_address,
          description: "Sorgente Microsoft Graph configurata dalla console React.",
          sender_allowlist_text: form.sender_allowlist_text,
          subject_include_text: form.subject_include_text,
          subject_exclude_text: "",
          body_include_text: form.body_include_text,
          attachment_extensions: "",
          max_messages_per_run: form.max_messages_per_run,
          mark_as_read_after_import: form.mark_as_read_after_import,
          process_attachments: false,
          process_email_body: true,
        });
        setMessage("Sorgente Microsoft Graph creata. Ora puoi avviare l'importazione.");
      }
      await loadSources();
      setEditingSourceId(null);
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.message || "Salvataggio sorgente Graph fallito");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveGraphSettings(settingsForm);
      const confirmed = await fetchGraphSettings();
      setGraphSettings(confirmed);
      setSettingsForm((current) => ({
        ...current,
        tenant_id: "",
        client_id: "",
        client_secret: "",
        mail_folder: confirmed.mail_folder || saved.mail_folder || "Inbox",
      }));
      setMessage(
        confirmed.configured
          ? "Credenziali Microsoft Graph salvate e confermate dal backend."
          : "Salvataggio ricevuto, ma la configurazione risulta ancora incompleta. Controlla Tenant ID, Client ID e Client secret.",
      );
    } catch (err: any) {
      setError(err?.message || "Salvataggio credenziali Graph fallito");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunGraph = async (source: ReportSource) => {
    setRunningSourceId(source.id);
    setError(null);
    setMessage(null);
    try {
      const result = await runSourceIngestion(source.id);
      if (result.status === "failed") {
        setError(result.error_message || "Importazione Microsoft Graph fallita. Verifica prerequisiti server e permessi Graph.");
      } else {
        setMessage(
          `Importazione Graph completata: ${result.imported_messages_count} importati, ${result.duplicate_messages_count} duplicati, ${result.generated_alerts_count} alert.`,
        );
      }
      await loadSources();
    } catch (err: any) {
      setError(err?.message || "Chiamata Microsoft Graph fallita");
    } finally {
      setRunningSourceId(null);
    }
  };

  const canSaveSource = form.name.trim() && /^[a-z0-9-]+$/.test(form.code) && (editingSourceId || form.mailbox_address.includes("@"));

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">Integrazione</div>
            <h1 className="text-2xl font-bold text-slate-950">Microsoft Graph</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Gestisci le mailbox Microsoft 365 usate dal Security Center. Qui configuri sorgenti e filtri operativi; le credenziali restano lato server.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadSources}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Aggiorna
            </button>
            <a className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" href="/inbox">
              Monitor ingressi
            </a>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}. Se vedi 403, verifica sessione e permessi, poi torna su questa pagina.
        </div>
      )}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</div>}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Credenziali Microsoft Graph</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Salva tenant, app registration e credenziale lato backend. Per sicurezza i valori salvati non vengono rimostrati nel form: sotto vedi solo lo stato.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${graphSettings?.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            {graphSettings?.configured ? "Credenziali configurate" : "Credenziali mancanti"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
          <StatusPill ok={Boolean(graphSettings?.tenant_configured)} label="Tenant ID" />
          <StatusPill ok={Boolean(graphSettings?.client_configured)} label="Client ID" />
          <StatusPill ok={Boolean(graphSettings?.secret_configured)} label="Client secret" />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
            Cartella: {graphSettings?.mail_folder || "Inbox"}
          </div>
        </div>
        {graphSettings?.updated_at && (
          <div className="mt-2 text-xs font-semibold text-slate-500">
            Ultimo salvataggio: {new Date(graphSettings.updated_at).toLocaleString("it-IT")}
          </div>
        )}
        {graphSettings && !graphSettings.can_save && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            Il tuo utente puo vedere Security Center, ma non ha il permesso per salvare credenziali Graph. Serve staff o permesso manage_security_configuration.
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Tenant ID">
            <input
              className={fieldClass}
              value={settingsForm.tenant_id}
              placeholder={graphSettings?.tenant_configured ? "Gia configurato - reinserisci per modificare" : "00000000-0000-0000-0000-000000000000"}
              onChange={(event) => setSettingsForm((current) => ({ ...current, tenant_id: event.target.value }))}
            />
          </Field>
          <Field label="Client ID">
            <input
              className={fieldClass}
              value={settingsForm.client_id}
              placeholder={graphSettings?.client_configured ? "Gia configurato - reinserisci per modificare" : "00000000-0000-0000-0000-000000000000"}
              onChange={(event) => setSettingsForm((current) => ({ ...current, client_id: event.target.value }))}
            />
          </Field>
          <Field label="Client secret">
            <input
              className={fieldClass}
              type="password"
              value={settingsForm.client_secret}
              placeholder={graphSettings?.secret_configured ? "Gia salvato - lascia vuoto per mantenerlo" : "Incolla il secret dell'app Entra"}
              onChange={(event) => setSettingsForm((current) => ({ ...current, client_secret: event.target.value }))}
            />
          </Field>
          <Field label="Cartella mailbox">
            <input
              className={fieldClass}
              value={settingsForm.mail_folder}
              onChange={(event) => setSettingsForm((current) => ({ ...current, mail_folder: event.target.value }))}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Usa il nome visibile della cartella, ad esempio SECURITY. Se la lasci vuota viene usata Inbox.
            </span>
          </Field>
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={savingSettings || graphSettings?.can_save === false}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingSettings ? "Salvataggio..." : "Salva credenziali Graph"}
        </button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">{editingSourceId ? "Modifica sorgente Graph" : "Nuova sorgente Graph"}</h2>
            {editingSourceId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Annulla modifica
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Nome sorgente">
              <input className={fieldClass} value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </Field>
            <Field label="Codice sorgente">
              <input className={fieldClass} value={form.code} disabled={Boolean(editingSourceId)} onChange={(event) => updateForm("code", event.target.value)} />
            </Field>
            <Field label="Mailbox Microsoft 365">
              <input className={fieldClass} type="email" value={form.mailbox_address} onChange={(event) => updateForm("mailbox_address", event.target.value)} />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {editingSourceId ? "Lascia vuoto per mantenere la mailbox gia salvata." : "Inserisci la mailbox condivisa o dedicata da controllare."}
              </span>
            </Field>
            <Field label="Messaggi per importazione">
              <input
                className={fieldClass}
                type="number"
                min={1}
                max={500}
                value={form.max_messages_per_run}
                onChange={(event) => updateForm("max_messages_per_run", Number(event.target.value))}
              />
            </Field>
            <Field label="Mittenti consentiti">
              <textarea className={`${fieldClass} min-h-24`} value={form.sender_allowlist_text} onChange={(event) => updateForm("sender_allowlist_text", event.target.value)} />
            </Field>
            <Field label="Oggetto deve contenere">
              <textarea className={`${fieldClass} min-h-24`} value={form.subject_include_text} onChange={(event) => updateForm("subject_include_text", event.target.value)} />
            </Field>
            <Field label="Corpo email deve contenere">
              <textarea className={`${fieldClass} min-h-24 md:col-span-2`} value={form.body_include_text} onChange={(event) => updateForm("body_include_text", event.target.value)} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.mark_as_read_after_import}
              onChange={(event) => updateForm("mark_as_read_after_import", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Marca come letto dopo importazione
          </label>
          <button
            onClick={handleSaveSource}
            disabled={!canSaveSource || saving}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : editingSourceId ? "Salva modifiche Graph" : "Crea sorgente Graph"}
          </button>
        </div>

        <div className="space-y-4">
          <StatusPanel title="Prerequisiti server" tone="warning" items={[
            "App registration Microsoft Entra configurata da amministratore.",
            "Permessi Graph Mail.Read concessi e approvati.",
            "Tenant, client id e credenziale salvati solo lato backend/server.",
            "Mailbox condivisa o dedicata raggiungibile dall'app Graph.",
          ]} />
          <StatusPanel title="Cosa fa questa pagina" tone="info" items={[
            "Crea una sorgente source_type=graph.",
            "Salva mailbox, filtri mittente, oggetto e corpo email.",
            "Non salva password, token o client secret.",
            "Mostra chiaramente se le API backend non sono raggiungibili.",
          ]} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Sorgenti Graph configurate</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{graphSources.length}</span>
        </div>
        {loading ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Caricamento sorgenti...</div>
        ) : graphSources.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {graphSources.map((source) => (
              <div key={source.id} className="rounded-lg border border-slate-200 p-4">
                {source.latestRun && (
                  <div className={`mb-3 rounded-lg border p-3 text-sm ${graphRunTone(source.latestRun.status)}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold">Ultimo sync Graph</div>
                      <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-bold">{graphRunLabel(source.latestRun.status)}</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <GraphRunMetric label="Avvio" value={formatGraphDate(source.latestRun.startedAt)} />
                      <GraphRunMetric label="Fine" value={formatGraphDate(source.latestRun.finishedAt)} />
                      <GraphRunMetric label="Importati" value={String(source.latestRun.imported)} />
                      <GraphRunMetric label="Duplicati" value={String(source.latestRun.duplicates)} />
                      <GraphRunMetric label="Processati" value={String(source.latestRun.processed)} />
                      <GraphRunMetric label="Alert" value={String(source.latestRun.alerts)} />
                    </div>
                    {source.latestRun.errorMessage && <div className="mt-2 font-semibold text-red-700">{source.latestRun.errorMessage}</div>}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-950">{source.name}</div>
                    <div className="mt-1 text-sm text-slate-600">{source.mailboxAddress || "Mailbox non indicata"}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{source.status}</span>
                    <button
                      type="button"
                      onClick={() => handleEditSource(source)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunGraph(source)}
                      disabled={runningSourceId === source.id || source.status === "disabled"}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {runningSourceId === source.id ? "Importazione..." : "Importa ora"}
                    </button>
                  </div>
                </div>
                {source.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {source.warnings.map((warning) => (
                      <div key={warning} className="flex gap-2 text-sm text-amber-800">
                        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!source.latestRun && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                    Nessun sync Graph registrato. Premi Importa ora per avviare la prima esecuzione.
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Nessuna sorgente Microsoft Graph configurata. Crea la prima sorgente dal pannello sopra.
          </div>
        )}
      </section>
    </div>
  );
}

const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function StatusPanel({ title, tone, items }: { title: string; tone: "info" | "warning"; items: string[] }) {
  const classes = tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950";
  return (
    <div className={`rounded-lg border p-4 ${classes}`}>
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      {label}: {ok ? "salvato" : "mancante"}
    </div>
  );
}

function graphRunLabel(status: NonNullable<ReportSource["latestRun"]>["status"]) {
  const labels = {
    pending: "In attesa",
    running: "In corso",
    success: "Riuscito",
    partial: "Parziale",
    failed: "Fallito",
  };
  return labels[status] ?? status;
}

function graphRunTone(status: NonNullable<ReportSource["latestRun"]>["status"]) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-950";
  return "border-blue-200 bg-blue-50 text-blue-950";
}

function formatGraphDate(value: string | null) {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function GraphRunMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>
      <span className="ml-2 font-semibold text-slate-900">{value}</span>
    </div>
  );
}
