# Pacchetto TEST Windows

Questa guida descrive il workflow operativo per preparare e avviare Security Center AI su un PC Windows di test, con SQL Server o SQL Server Express e un solo endpoint Django in LAN.

Questo non e un deployment production hardened. Usare solo in LAN, non esporre su Internet e non usare dati o credenziali reali. Il pacchetto puo essere usato in modalita manuale legacy oppure come base per il servizio Windows con Waitress.

## Prerequisiti

- Windows 10/11 o Windows Server.
- Python supportato dal progetto e disponibile nel `PATH`.
- Node.js LTS con npm.
- SQL Server o SQL Server Express raggiungibile dal PC di test.
- ODBC Driver 18 for SQL Server installato.
- Pacchetto o checkout di Security Center AI copiato sul PC di test.
- WinSW preferito per la modalita servizio Windows; fornire `tools\windows\winsw.exe` oppure `winsw.exe` nel `PATH`.
- NSSM resta fallback opzionale; fornire `tools\windows\nssm.exe` oppure `nssm.exe` nel `PATH`.

## Database SQL Server TEST

Creare un database dedicato e separato da qualunque ambiente reale:

```sql
CREATE DATABASE SecurityCenterAI_TEST;
```

Il wizard SQL Server verifica se il database configurato esiste. Il DB deve esistere oppure puo essere creato solo con richiesta esplicita dell'operatore, tramite prompt interattivo o parametro `-CreateDatabase`. Se manca e non viene creato, il setup si ferma prima delle migrazioni e mostra lo script manuale:

```sql
CREATE DATABASE [SecurityCenterAI_TEST];
```

Usare permessi e credenziali di test. Con autenticazione Windows, l'utente che avvia Django deve avere accesso al database. Con autenticazione SQL, usare solo account di test e non committare mai password.

## Configurazione guidata `.env`

Dal repository root o dalla cartella estratta del pacchetto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -TestConnection
```

Il wizard crea `.env` da `.env.test-sqlserver.example` se manca, aggiorna solo le chiavi SQL Server/deployment gestite e conserva eventuali chiavi manuali non correlate. Se `.env` esiste e non viene usato `-Force`, chiede conferma prima di aggiornare la configurazione.

Inserire:

- `DB_HOST`: istanza SQL Server di test, ad esempio `localhost\SQLEXPRESS`.
- `DB_NAME`: database SQL Server di test, ad esempio `SecurityCenterAI_TEST`.
- `ALLOWED_HOSTS`: `127.0.0.1`, `localhost` e l'IP LAN del PC di test.
- `DB_TRUSTED_CONNECTION=True` per autenticazione Windows, oppure `False` con `DB_USER` e `DB_PASSWORD` di test.
- porta applicazione, default `8000`.

Con autenticazione SQL, la password viene richiesta con input sicuro e non viene stampata. La password SQL viene salvata localmente in `.env`.

Uso non interattivo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -DbHost "localhost\SQLEXPRESS" -DbName "SecurityCenterAI_TEST" -TrustedConnection True -AllowedHosts "127.0.0.1,localhost" -Port 8000 -DebugMode True -Force -TestConnection
```

Il supporto manuale resta disponibile:

```powershell
Copy-Item .env.test-sqlserver.example .env
notepad .env
```

Non committare `.env`. Non copiare `.env` dentro ticket, documenti o chat. `.env` contiene segreti se si usa autenticazione SQL.

## Setup iniziale

Eseguire da PowerShell nella cartella del progetto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo
```

Lo script puo avviare il wizard SQL Server, verifica Python, Node/npm e ODBC Driver 18, crea `.venv` se manca, installa le dipendenze Python, installa le dipendenze frontend se necessarie, esegue `npm --prefix frontend run build`, controlla SQL Server con `security_db_check`, applica le migrazioni e, con `-SeedDemo`, carica dati sintetici UAT ed esegue lo smoke check.

Per installare anche il servizio Windows con Waitress:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo -InstallService
```

Comando consigliato per setup completo, creazione esplicita DB TEST e servizio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService
```

Se `.env` manca e `-ConfigureSqlServer` non viene usato, lo script indica di eseguire `configure_sqlserver_env.ps1` oppure creare `.env` da `.env.test-sqlserver.example`.

Il servizio richiede privilegi amministrativi, preferisce WinSW, usa NSSM solo come fallback, esegue `python -m waitress --host=0.0.0.0 --port=8000 security_center_ai.wsgi:application` e non usa `manage.py runserver`.

Opzioni utili:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -SeedDemo -SkipSmokeCheck
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -SkipFrontendBuild
```

## Avvio, apertura e stop

### Servizio Windows consigliato

Installare e avviare il servizio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install_service.ps1 -StartService
```

Controllare lo stato:

```powershell
.\scripts\windows\service_status.bat
```

Fermare o riavviare:

```powershell
.\scripts\windows\stop_service.bat
.\scripts\windows\restart_service.bat
```

### Modalita manuale legacy

Avviare Django:

```powershell
.\scripts\windows\start_security_center.bat
```

Aprire il browser locale:

```powershell
.\scripts\windows\open_security_center.bat
```

URL locale:

```text
http://127.0.0.1:8000/
```

Da un altro PC nella stessa LAN:

```text
http://<PC-IP>:8000/
```

Fermare o riavviare la modalita manuale:

```powershell
.\scripts\windows\stop_security_center.bat
.\scripts\windows\restart_security_center.bat
```

Gli script usano `SC_HOST` e `SC_PORT` se impostati. I valori predefiniti sono `0.0.0.0` e `8000`.

Esempio:

```powershell
$env:SC_PORT = "8000"
.\scripts\windows\start_security_center.bat
```

Lo stop usa il PID registrato dallo start script quando possibile. Se il PID non e disponibile, ferma solo listener sul port configurato la cui command line contiene `manage.py runserver`; per sicurezza non uccide processi Python generici o servizi non riconosciuti.

## Accesso LAN e firewall

Per consentire accesso da un altro PC in LAN, verificare:

- `ALLOWED_HOSTS` contiene l'IP LAN del PC di test.
- Il firewall Windows consente TCP 8000.
- Il PC remoto apre `http://<PC-IP>:8000/`.

Esempio firewall da PowerShell amministrativa:

```powershell
New-NetFirewallRule -DisplayName "Security Center AI 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

Script idempotente dedicato:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\open_firewall_8000.ps1
```

Non creare regole NAT, pubblicazioni Internet o reverse proxy pubblici per questo pacchetto TEST.

## Demo e smoke check

Il seed demo usa solo dati sintetici:

```powershell
.\.venv\Scripts\python.exe manage.py seed_security_uat_demo --reset
.\.venv\Scripts\python.exe manage.py seed_security_uat_demo
.\.venv\Scripts\python.exe manage.py security_uat_smoke_check
```

Per setup completo con seed e smoke:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -SeedDemo
```

## Creazione pacchetto distribuibile

Da una macchina di sviluppo con build frontend pronta:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Zip
```

Lo script crea `dist\SecurityCenterAI-Test-<version>\` e, con `-Zip`, `dist\SecurityCenterAI-Test-<version>.zip`.

Il pacchetto include backend, `frontend/dist`, `requirements.txt`, `manage.py`, script Windows, documentazione sotto `docs/security-center` e `.env.test-sqlserver.example`.

Se disponibile localmente prima del packaging, include `tools\windows\winsw.exe` come wrapper preferito e `tools\windows\nssm.exe` come fallback opzionale. I file possono essere preparati in `tools/windows/winsw.exe` e `tools/windows/nssm.exe` nel repository di lavoro; lo script li copia automaticamente nel pacchetto. Non viene eseguito alcun download automatico.

Fonte consigliata WinSW: release ufficiali WinSW su GitHub. Fonte consigliata NSSM: release ufficiale NSSM. Verificare origine, hash, integrita, licenza e diritto di redistribuzione prima di creare il pacchetto. Non rinominare eseguibili non correlati in `winsw.exe` o `nssm.exe`; la responsabilita dei binari resta dell'operatore.

Se `tools\windows\winsw.exe` manca, il pacchetto viene comunque creato e lo script mostra:

```text
WinSW non trovato: il servizio Windows usera NSSM se disponibile, altrimenti l'installazione del servizio non sara possibile.
```

Se mancano sia WinSW sia NSSM, il pacchetto viene comunque creato e avvisa di copiare `winsw.exe` in `tools\windows\winsw.exe` oppure `nssm.exe` in `tools\windows\nssm.exe`. Un pacchetto senza wrapper puo installare file e dipendenze, ma `-InstallService` e `install_service.ps1` falliranno finche non viene fornito un wrapper.

Il pacchetto esclude `.git`, `.venv`, `node_modules`, cache, `.env`, database locali, log, upload, raw data e file con estensioni o nomi tipici di segreti.

## Troubleshooting

- `ODBC Driver 18 for SQL Server non trovato`: installare Microsoft ODBC Driver 18 for SQL Server sul PC di test.
- `security_db_check` fallisce: verificare `DB_HOST`, nome database `SecurityCenterAI_TEST`, permessi SQL Server e driver ODBC.
- Browser da LAN non apre: verificare firewall, IP corretto e `ALLOWED_HOSTS`.
- Errore build frontend: rieseguire senza `-SkipFrontendBuild` e verificare Node.js LTS.
- `Nessun wrapper servizio trovato`: copiare `winsw.exe` in `tools\windows\winsw.exe` oppure `nssm.exe` in `tools\windows\nssm.exe`.
- `WinSW non trovato, uso fallback NSSM`: WinSW non e disponibile; il setup usa NSSM se presente.
- Smoke check fallisce: eseguire `seed_security_uat_demo --reset`, poi `seed_security_uat_demo`, poi `security_uat_smoke_check`.
- Stop non ferma il servizio: chiudere la finestra/processo Django avviato manualmente. Lo script evita di terminare processi non riconosciuti.

## Uninstall e database

Lo standard uninstall non elimina il database SQL Server. La disinstallazione rimuove i file installati e tenta di fermare/rimuovere il servizio `SecurityCenterAI`, ma il database viene mantenuto per evitare perdita dati.

Rimozione opzionale e separata del database TEST:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\drop_test_database.ps1
```

`drop_test_database.ps1` legge la configurazione dalla `.env`, non stampa password, rifiuta nomi senza `TEST` o `UAT` salvo `-ForceUnsafeName` e richiede conferma digitata esatta `DROP <DB_NAME>`.

## Installer EXE

Per creare un installer Windows `.exe` a partire da questo pacchetto TEST, vedere `WINDOWS_INSTALLER_EXE.md`.

Per il flusso completo come servizio Windows con Waitress, vedere anche `WINDOWS_SERVICE_DEPLOYMENT.md`.

## Limiti

- Il pacchetto folder/ZIP resta il formato base; l'installer `.exe` e solo un wrapper Inno Setup per test LAN.
- Il servizio Windows richiede installazione separata, privilegi amministrativi e un wrapper: WinSW preferito, NSSM fallback.
- Python resta necessario per creare `.venv` finche non verra introdotto un runtime embedded.
- Il servizio usa Waitress; la modalita manuale legacy usa ancora `manage.py runserver`.
- Microsoft Graph richiede configurazione server separata tramite variabili ambiente e permessi Entra approvati; il pacchetto non include credenziali Graph.
- Nessuna integrazione IMAP.
- Nessuna chiamata esterna automatica aggiunta dal pacchetto; l'ingestion Graph parte solo da sorgenti configurate ed esecuzioni esplicite/schedulate.
- SQLite resta utile solo per sviluppo locale rapido; il test aziendale usa SQL Server.
