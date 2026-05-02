# Deployment servizio Windows TEST

Questa guida descrive come eseguire Security Center AI come servizio Windows per una LAN di test.

Il servizio usa Waitress e non usa `manage.py runserver`. Il deployment resta destinato a test aziendali in LAN, non a produzione hardened e non a esposizione Internet.

## Cosa fa l'installer attuale

L'installer `.exe` copia file, script e documentazione sotto `C:\Program Files\Security Center AI`, ma non registra da solo il servizio Windows. L'installazione del servizio e un passaggio separato e richiede privilegi amministrativi.

## Prerequisiti

- SQL Server o SQL Server Express gia pronto con database di test.
- ODBC Driver 18 for SQL Server installato.
- Python disponibile per creare `.venv`.
- Node.js LTS disponibile per l'eventuale build frontend durante il setup iniziale.
- WinSW preferito per la modalita servizio Windows: `winsw.exe` disponibile in `tools\windows\winsw.exe` oppure nel `PATH`.
- NSSM resta fallback opzionale: `nssm.exe` disponibile in `tools\windows\nssm.exe` oppure nel `PATH`.

Limite attuale: Python resta necessario per creare `.venv` e installare le dipendenze. Un runtime embedded potra eliminare questo prerequisito in una patch futura.

## WinSW e fallback NSSM

La modalita servizio Windows preferisce WinSW. Posizionare il binario x64 verificato in:

```text
tools\windows\winsw.exe
```

Fonte consigliata: release ufficiali WinSW su GitHub. Non rinominare eseguibili non correlati in `winsw.exe`. Verificare origine, hash, licenza e diritto di redistribuzione prima di impacchettare o installare il binario; questa responsabilita resta dell'operatore.

NSSM resta fallback opzionale. Se WinSW non e disponibile, posizionare il binario NSSM verificato in:

```text
tools\windows\nssm.exe
```

Il package builder include automaticamente `tools/windows/winsw.exe` e `tools/windows/nssm.exe` se i file sono presenti prima della creazione del pacchetto. Non viene eseguito alcun download automatico.

Se WinSW e NSSM non sono inclusi nel pacchetto o nell'installer, l'installazione dei file puo comunque riuscire, ma l'installazione del servizio fallira finche non viene fornito `tools\windows\winsw.exe`, `winsw.exe` nel `PATH`, `tools\windows\nssm.exe` oppure `nssm.exe` nel `PATH`.

## Configurazione guidata `.env`

Prima di installare il servizio:

```powershell
cd "C:\Program Files\Security Center AI"
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -TestConnection
```

Il wizard crea `.env` da `.env.test-sqlserver.example` se manca e aggiorna solo chiavi SQL Server/deployment gestite. Se `.env` esiste, chiede conferma prima di modificarla e preserva le altre chiavi manuali.

Configurare:

- `DB_HOST`
- `DB_NAME=SecurityCenterAI_TEST`
- `ALLOWED_HOSTS`
- autenticazione Windows/Trusted Connection oppure eventuale autenticazione SQL di test
- porta applicazione, default `8000`

La password SQL viene richiesta con input sicuro, non viene stampata e viene salvata solo nella `.env` locale se si usa autenticazione SQL.

Il supporto manuale resta disponibile:

```powershell
Copy-Item .env.test-sqlserver.example .env
notepad .env
```

Non committare `.env`. `.env` contiene segreti se si usa autenticazione SQL. Non inserire credenziali reali o segreti reali.

## Preparare SQL Server TEST

```sql
CREATE DATABASE SecurityCenterAI_TEST;
```

Usare solo credenziali di test. Il servizio legge `.env` tramite le impostazioni Django correnti.

## Setup completo con installazione servizio

Da PowerShell amministrativa:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo -InstallService
```

Se il database TEST non esiste e l'utente SQL/Windows ha permessi sufficienti, la creazione deve essere richiesta esplicitamente:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService
```

Lo script:

- configura `.env` con il wizard SQL Server se richiesto
- crea `.venv` se manca
- installa dipendenze Python, inclusa Waitress
- verifica o builda `frontend/dist`
- esegue `security_db_check`
- esegue `migrate`
- opzionalmente carica dati demo
- installa il servizio `SecurityCenterAI`
- avvia il servizio

## Installazione servizio separata

Se il setup e gia stato eseguito:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install_service.ps1 -StartService
```

Il servizio viene registrato come:

- Service name: `SecurityCenterAI`
- Display name: `Security Center AI`
- Wrapper preferito: WinSW
- Fallback: NSSM

Con WinSW lo script genera dinamicamente:

```text
tools\windows\winsw.xml
tools\windows\SecurityCenterAI.xml
```

`winsw.xml` e il file operativo per WinSW perche ha lo stesso nome base di `winsw.exe`; `SecurityCenterAI.xml` viene mantenuto come copia leggibile/compatibile. Il file XML contiene il percorso locale di `.venv\Scripts\python.exe`, gli argomenti Waitress, la working directory dell'app e il percorso `logs`. Non contiene `DB_PASSWORD`, `SECRET_KEY` o altri segreti.

Processo applicativo:

```text
python -m waitress --host=0.0.0.0 --port=8000 security_center_ai.wsgi:application
```

Working directory: root applicativo.

## Comandi operatore

Installare il servizio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install_service.ps1 -StartService
```

Avviare:

```powershell
.\scripts\windows\start_service.bat
```

Fermare:

```powershell
.\scripts\windows\stop_service.bat
```

Riavviare:

```powershell
.\scripts\windows\restart_service.bat
```

Verificare stato:

```powershell
.\scripts\windows\service_status.bat
```

Disinstallare:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\uninstall_service.ps1
```

L'uninstaller Inno Setup tenta di eseguire lo stesso script per fermare e rimuovere il servizio `SecurityCenterAI` prima di cancellare i file applicativi. Lo standard uninstall non elimina il database SQL Server: la retention e intenzionale per evitare perdita dati.

La pulizia del database TEST e separata:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\drop_test_database.ps1
```

`drop_test_database.ps1` richiede conferma forte `DROP <DB_NAME>`, rifiuta database senza `TEST` o `UAT` nel nome salvo `-ForceUnsafeName` e non viene mai richiamato dal servizio o dall'uninstaller.

Aprire il browser:

```powershell
.\scripts\windows\open_security_center.bat
```

## Firewall LAN

Per aprire solo TCP 8000 in modo esplicito e idempotente:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\open_firewall_8000.ps1
```

La regola creata e:

```text
Security Center AI 8000
```

## URL

Locale:

```text
http://127.0.0.1:8000/
```

LAN:

```text
http://<PC-IP>:8000/
```

## Log

I log del servizio vengono scritti in:

- `logs\service.out.log`
- `logs\service.err.log`
- `logs\launcher.log`

`service.out.log` e `service.err.log` vengono gestiti dal wrapper del servizio. `launcher.log` registra azioni di installazione, start, stop e warning operativi senza stampare credenziali o segreti.

## Troubleshooting

- `Nessun wrapper servizio trovato`: copiare `winsw.exe` in `tools\windows\winsw.exe` oppure `nssm.exe` in `tools\windows\nssm.exe`.
- `WinSW non trovato, uso fallback NSSM`: WinSW non e disponibile; il setup usa NSSM se presente.
- `Waitress` non trovato: rieseguire `setup_test_deployment.ps1` oppure `pip install -r requirements.txt` nella `.venv`.
- Servizio parte ma browser non risponde: verificare firewall, `ALLOWED_HOSTS`, porta 8000 e stato del servizio.
- Errori SQL Server: verificare database `SecurityCenterAI_TEST`, driver ODBC 18, host SQL e credenziali di test nella `.env`.
- Installazione/rimozione servizio fallisce: usare PowerShell come Amministratore.
- Nessun accesso da LAN: aprire la regola `Security Center AI 8000` o eseguire `open_firewall_8000.ps1`.

## Limiti

- Deployment solo LAN/test.
- Nessuna integrazione Microsoft Graph automatica: Graph richiede configurazione server separata tramite variabili ambiente e permessi Entra approvati; il servizio non installa credenziali Graph.
- Nessuna integrazione IMAP.
- WinSW e il wrapper preferito; NSSM e solo fallback.
- Nessun download automatico di WinSW o NSSM.
- Nessun runtime Python embedded in questa patch.
