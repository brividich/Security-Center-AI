# Mailbox Ingestion - Security Center AI

**Versione:** 1.1 (Patch 16)  
**Data:** 2026-04-28

---

## Panoramica

Il sistema di **Mailbox Ingestion** permette l'importazione automatica e schedulata di report e alert di sicurezza da sorgenti email configurate, con elaborazione completa attraverso la pipeline parser/rule/KPI/alert/evidence.

### Scopo

- Automatizzare l'ingestion di report periodici (WatchGuard, Defender, Backup, ecc.)
- Ridurre il carico manuale di upload tramite Inbox/Workbench
- Mantenere evidenza storica completa dei report ricevuti
- Deduplica automatica per evitare elaborazioni multiple
- Integrazione completa con pipeline parser/rule esistente
- Generazione automatica di alert e ticket da messaggi importati

---

## Architettura

### Componenti

1. **SecurityMailboxSource** - Configurazione sorgente mailbox
2. **SecurityMailboxIngestionRun** - Tracciamento esecuzioni
3. **Mailbox Providers** - Astrazione provider (Mock, Graph, IMAP)
4. **Ingestion Service** - Logica import e deduplicazione
5. **Security Inbox Pipeline** - Elaborazione condivisa parser/rule/KPI/alert
6. **Management Command** - Esecuzione manuale/schedulata

### Flusso Completo

```
Mailbox Provider → Fetch Messages → Filter → Deduplicate → Import → 
  → Security Inbox Pipeline → Parser → Rules → KPI → Alerts → Evidence → Tickets
```

### Pipeline Condivisa

Il modulo `security/services/security_inbox_pipeline.py` fornisce elaborazione unificata per:

- Inbox Workbench (paste/upload manuale)
- Mailbox Ingestion (import automatico)
- Messaggi email importati
- Allegati importati

**Funzioni principali:**

- `process_mailbox_message(message, *, source=None, run=None, dry_run=False)` - Processa corpo email importato
- `process_source_file(source_file, *, message=None, source=None, run=None, dry_run=False)` - Processa allegato importato
- `process_text_payload(text, *, subject, sender, source, dry_run)` - Processa testo raw (crea SecurityMailboxMessage transient)
- `process_security_input(item, *, source, run, dry_run)` - Dispatcher unificato per tipo (SecurityMailboxMessage o SecuritySourceFile)

**Comportamento:**

- Verifica stato elaborazione (skip se già processato)
- Match parser abilitato
- Esecuzione parser
- Valutazione regole alert
- Generazione KPI/evidence/ticket
- Aggiornamento `parse_status` e `pipeline_result` su `SecurityMailboxMessage`
- Tracciamento errori/warning

### Campo pipeline_result

`SecurityMailboxMessage` espone un campo JSONField `pipeline_result` aggiornato dopo ogni elaborazione (Patch 16, migration 0006):

```json
{
  "status": "success",
  "parser_matched": true,
  "parser_name": "synology_active_backup_email_parser",
  "reports_parsed": 1,
  "metrics_created": 3,
  "events_created": 1,
  "alerts_created": 0,
  "evidence_created": 0,
  "tickets_changed": 0
}
```

---

## Provider Supportati

### Mock Provider (Corrente)

- **Tipo:** `mock`
- **Scopo:** Testing e sviluppo
- **Comportamento:** Restituisce lista vuota, nessuna connessione esterna
- **Uso:** Default per nuove sorgenti

### Microsoft Graph (Futuro)

- **Tipo:** `graph`
- **Scopo:** Mailbox Microsoft 365 / Exchange Online
- **Stato:** Placeholder, non implementato
- **Requisiti:** Credenziali Graph API, permessi Mail.Read

### IMAP (Futuro)

- **Tipo:** `imap`
- **Scopo:** Mailbox IMAP generiche
- **Stato:** Placeholder, non implementato
- **Requisiti:** Credenziali IMAP, SSL/TLS

---

## Configurazione Sorgente

### Campi Principali

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `name` | String | Nome descrittivo sorgente |
| `code` | String | Codice univoco (slug) |
| `enabled` | Boolean | Abilita/disabilita ingestion |
| `source_type` | Choice | `mock`, `graph`, `imap` |
| `mailbox_address` | Email | Indirizzo mailbox da monitorare |
| `max_messages_per_run` | Integer | Limite messaggi per esecuzione (default: 50) |

### Filtri

| Campo | Descrizione |
|-------|-------------|
| `sender_allowlist_text` | Mittenti consentiti (uno per riga) |
| `subject_include_text` | Oggetto deve contenere (uno per riga) |
| `subject_exclude_text` | Oggetto deve escludere (uno per riga) |
| `body_include_text` | Corpo deve contenere (uno per riga) |
| `attachment_extensions` | Estensioni allegati consentite (es: `pdf,csv`) |

### Opzioni Elaborazione

| Campo | Default | Descrizione |
|-------|---------|-------------|
| `process_attachments` | True | Elabora allegati come SecuritySourceFile |
| `process_email_body` | True | Elabora corpo email come contenuto |
| `mark_as_read_after_import` | False | Marca messaggi come letti (provider-dependent) |

---

## Deduplicazione e Reprocessing

### Strategia Deduplicazione

La deduplicazione avviene tramite fingerprint SHA-256 calcolato su:

1. **Provider Message ID** (se disponibile) - priorità massima
2. **Internet Message ID** (RFC 2822) - priorità alta
3. **Hash composito** - fallback:
   - Source ID
   - Sender
   - Subject
   - Received timestamp
   - Body snippet (primi 200 caratteri)

### Comportamento Default

- Messaggi duplicati vengono **saltati** senza elaborazione
- Counter `duplicate_messages_count` incrementato
- Nessun alert/log generato per duplicati

### Reprocessing Safety

**Stato elaborazione:** Ogni messaggio e file importato ha un campo `parse_status`:

- `pending` - Non ancora elaborato
- `parsed` - Elaborato con successo
- `failed` - Elaborazione fallita
- `skipped` - Nessun parser disponibile

**Regole di sicurezza:**

1. Messaggi con `parse_status != pending` vengono **saltati** automaticamente
2. Messaggi già elaborati non vengono riprocessati in esecuzioni successive
3. Flag `--force-reprocess` forza rielaborazione anche di messaggi già processati
4. Dry-run non modifica mai `parse_status` e non ha side-effects

**Esempio flusso:**

```
Run 1: Import messaggio → parse_status=pending → Elabora → parse_status=parsed
Run 2: Trova messaggio esistente → parse_status=parsed → Skip (già processato)
Run 3 (--force-reprocess): Trova messaggio → Forza parse_status=pending → Rielabora
```
- Dedup è **cross-run**: un messaggio importato in run precedenti non viene reimportato

---

## Management Command

### Sintassi

```bash
python manage.py ingest_security_mailbox [options]
```

### Opzioni

| Opzione | Descrizione |
|---------|-------------|
| `--source <code>` | Esegui solo per sorgente specifica |
| `--dry-run` | Simula senza creare record |
| `--limit <n>` | Limita messaggi per sorgente |
| `--process` | Elabora attraverso pipeline (default: True) |
| `--no-process` | Importa senza elaborare |
| `--force-reprocess` | Rielabora messaggi già processati |

### Esempi

```bash
# Tutte le sorgenti abilitate (con elaborazione)
python manage.py ingest_security_mailbox

# Sorgente specifica
python manage.py ingest_security_mailbox --source watchguard-daily

# Dry run (test)
python manage.py ingest_security_mailbox --dry-run

# Limite messaggi
python manage.py ingest_security_mailbox --limit 10

# Solo import, senza elaborazione
python manage.py ingest_security_mailbox --no-process

# Forza rielaborazione duplicati
python manage.py ingest_security_mailbox --force-reprocess
```

### Output

```
Processing 2 source(s)...

============================================================
Source: WatchGuard Daily (watchguard-daily)
Type: Mock
Mailbox: watchguard@example.com
Status: success
Imported: 5
Duplicates: 2
Skipped: 1
Files: 3
Processed: 8
Alerts: 2

============================================================
Ingestion complete
```

---

## Schedulazione

### Cron (Linux)

```bash
# Ogni ora
0 * * * * cd /path/to/project && python manage.py ingest_security_mailbox

# Ogni 6 ore
0 */6 * * * cd /path/to/project && python manage.py ingest_security_mailbox
```

### Task Scheduler (Windows)

1. Crea task schedulato
2. Trigger: Giornaliero o ogni N ore
3. Azione: `python.exe manage.py ingest_security_mailbox`
4. Working directory: `django_app/`

---

## Interfaccia Admin

### Lista Sorgenti

**URL:** `/security/admin/mailbox-sources/`

Mostra:
- Sorgenti configurate
- Stato (attivo/disattivo)
- Tipo provider
- Ultima esecuzione
- Ultimo successo
- Contatori ultima run

### Dettaglio Sorgente

**URL:** `/security/admin/mailbox-sources/<code>/`

Mostra:
- Configurazione completa
- Stato esecuzioni
- Esecuzioni recenti (ultimi 10 run) con colonne: importati, duplicati, saltati, file, processati, alert
- Messaggi recenti (ultimi 20) con stato parsing
- Errori e troubleshooting

---

## API Configuration Studio

L'endpoint `GET /security/api/configuration/sources/` include per ogni sorgente:

```json
{
  "latest_run": {
    "imported": 5,
    "skipped": 1,
    "duplicates": 2,
    "files": 3,
    "processed": 8,
    "alerts": 2
  }
}
```

---

## Sicurezza

### Principi

- **No secrets in UI**: Credenziali non esposte in pagine admin
- **Permission-gated**: Accesso richiede `can_view_security_center`
- **Fail-safe**: Errori non bloccano altre sorgenti
- **Audit trail**: Ogni run tracciato in `SecurityMailboxIngestionRun`

### Best Practices

1. Usare account mailbox dedicato (non personale)
2. Configurare filtri mittente restrittivi
3. Limitare `max_messages_per_run` per evitare sovraccarico
4. Monitorare `last_error_message` per problemi ricorrenti
5. Testare sempre con `--dry-run` prima di abilitare

---

## Troubleshooting

### Nessun messaggio importato

**Sintomi:** `imported_messages_count = 0`, `skipped_messages_count > 0`

**Cause:**
- Filtri troppo restrittivi (`sender_allowlist`, `subject_include`)
- Provider non configurato correttamente
- Mailbox vuota o messaggi già importati (duplicati)

**Rimedi:**
1. Verificare filtri in dettaglio sorgente
2. Eseguire con `--dry-run` per vedere log dettagliato
3. Controllare `last_error_message` per errori provider

### Duplicati elevati

**Sintomi:** `duplicate_messages_count` molto alto

**Cause:**
- Messaggi già importati in run precedenti
- Dedup key stabile (comportamento corretto)

**Rimedi:**
- Normale se mailbox contiene messaggi vecchi
- Considerare filtro temporale nel provider (futuro)

### Run status = failed

**Sintomi:** `status = failed`, `error_message` popolato

**Cause:**
- Errore connessione provider
- Errore parsing/processing
- Eccezione non gestita

**Rimedi:**
1. Leggere `error_message` in dettaglio sorgente
2. Verificare credenziali provider (quando implementato)
3. Controllare log applicazione per stack trace completo

### Provider non implementato

**Sintomi:** Warning log "Provider not yet implemented"

**Cause:**
- `source_type = graph` o `imap` ma provider non implementato

**Rimedi:**
- Usare `source_type = mock` per testing
- Attendere implementazione Graph/IMAP (future patch)

---

## Limitazioni Correnti

1. **Provider reali non implementati**: Solo Mock disponibile
2. **No filtro temporale**: Fetch sempre ultimi N messaggi
3. **No mark-as-read**: Opzione presente ma non funzionale su Mock
4. **No retry automatico**: Run falliti richiedono riesecuzione manuale
5. **No notifiche**: Errori non generano alert/email automatiche

---

## Changelog

### 1.1 - Patch 16 (2026-04-28)

- Aggiunto campo `pipeline_result` JSONField su `SecurityMailboxMessage` (migration 0006)
- Aggiunte funzioni `process_text_payload()` e `process_security_input()` al pipeline condiviso
- `process_mailbox_message()` persiste ora `pipeline_result` dopo elaborazione
- Suite test estesa: 31 test su pipeline, inclusi fixture sintetici (Defender CVE, Synology, WatchGuard ThreatSync, WatchGuard CSV)

### 1.0 - Patch 13 (2026-04-27)

- Implementazione iniziale pipeline wiring mailbox ingestion
- Componenti: SecurityMailboxSource, SecurityMailboxIngestionRun, provider Mock, management command

---

## Riferimenti

- [01_ARCHITECTURE.md](01_ARCHITECTURE.md) - Architettura generale
- [02_ADMIN_GUIDE.md](02_ADMIN_GUIDE.md) - Guida admin
- [10_DEVELOPER_GUIDE.md](10_DEVELOPER_GUIDE.md) - Guida sviluppo
- [11_OPERATIONS_RUNBOOK.md](11_OPERATIONS_RUNBOOK.md) - Runbook operativo

---

**Nota:** Provider reali (Graph/IMAP) saranno implementati in patch successive. Per ora, usare Mock provider per testing e preparazione configurazioni.
