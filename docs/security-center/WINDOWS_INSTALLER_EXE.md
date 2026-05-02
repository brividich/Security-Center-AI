# Installer EXE Windows TEST

Questa guida descrive il nuovo installer Windows `.exe` di Security Center AI: una procedura guidata classica Windows basata su Inno Setup, pensata per installare applicativo, configurazione database TEST, ambiente Python locale, migrazioni, dati demo sintetici opzionali e servizio Windows.

Il flusso operatore non richiede una finestra PowerShell. PowerShell resta usato solo come bootstrap interno nascosto per applicare le scelte del wizard e scrivere il log tecnico in `runtime\installer-setup.log`.

L'installer e per test LAN, non produzione hardened. Non esporre su Internet, non usare dati reali e non distribuire credenziali reali.

## Prerequisiti macchina build

- Windows 10/11 o Windows Server.
- Inno Setup 6 installato, con `ISCC.exe` nel `PATH` oppure nel percorso standard.
- Python, Node.js LTS e npm per creare il pacchetto TEST.
- Repository Security Center AI aggiornato.
- WinSW preferito per il servizio: `winsw.exe` in `tools\windows\winsw.exe` oppure nel `PATH`.
- NSSM resta fallback opzionale: `nssm.exe` in `tools\windows\nssm.exe` oppure nel `PATH`.

Download Inno Setup:

```text
https://jrsoftware.org/isinfo.php
```

## Creare il pacchetto TEST

Da repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version 0.5.17
```

Output atteso:

```text
dist\SecurityCenterAI-Test-0.5.17\
```

Il pacchetto e la sorgente dell'installer. Lo script di packaging esclude `.env`, `.venv`, `runtime`, `node_modules`, database locali, log, upload, allegati, mailbox, inbox, `security_raw_inbox`, report generati e file tipici di segreti come `.key`, `.pem`, `.pfx`, `.p12`, `.cer`, `.crt`.

Non viene eseguito alcun download automatico di WinSW o NSSM. Se si vogliono includere nel pacchetto, copiare prima binari verificati in:

```text
tools\windows\winsw.exe
tools\windows\nssm.exe
```

WinSW e il wrapper servizio preferito. NSSM resta solo fallback opzionale. Verificare origine, hash, licenza e diritto di redistribuzione prima di creare l'installer.

## Creare l'installer EXE

Da repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_installer.ps1 -Version 0.5.17
```

Output atteso:

```text
dist\installer\SecurityCenterAI-Setup-0.5.17.exe
```

Se `ISCC.exe` non viene trovato, installare Inno Setup 6 oppure impostare:

```powershell
$env:INNO_SETUP_ISCC = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

Lo script Inno Setup e:

```text
installer\windows\SecurityCenterAI-Test.iss
```

La versione viene passata dal build script con `-Version`. Il file `.iss` contiene anche un fallback manuale `AppVersion`; aggiornarlo solo se si compila direttamente con `ISCC.exe` senza usare il build script.

## Installare su PC di test

Eseguire:

```text
dist\installer\SecurityCenterAI-Setup-0.5.17.exe
```

La destinazione predefinita e:

```text
C:\Program Files\Security Center AI
```

L'installer richiede privilegi amministrativi. Il wizard mostra schermate Windows classiche per:

- Tipo installazione: completa guidata oppure solo copia file.
- Database SQL Server TEST: server SQL, database, driver ODBC, allowed hosts e porta.
- Autenticazione SQL Server: Trusted Connection oppure account SQL di test.
- Componenti e primo avvio: creazione esplicita del database TEST se manca, dati demo sintetici, servizio Windows, uso del frontend gia incluso, smoke check e apertura browser.
- Riepilogo finale prima della copia.

Durante il setup completo, l'installer:

- copia i file applicativi;
- crea `.env` da `.env.test-sqlserver.example` se manca;
- salva la configurazione SQL Server TEST nella `.env` locale;
- crea il database solo se l'opzione e stata selezionata e i permessi SQL lo consentono;
- crea `.venv` e installa `requirements.txt`;
- esegue `security_db_check` e `migrate`;
- carica dati demo sintetici se richiesto;
- installa e avvia il servizio Windows `SecurityCenterAI` se richiesto;
- apre il browser se richiesto.

Il collegamento Desktop per aprire Security Center AI e selezionato per impostazione predefinita. I collegamenti Start Menu creati sono:

- Apri Security Center AI
- Stato servizio
- Avvia servizio
- Arresta servizio
- Riavvia servizio
- Documentazione installazione

Non vengono creati collegamenti operatore a wizard PowerShell o setup PowerShell.

## Log e fallback

Il setup guidato interno usa:

```text
scripts\windows\installer_apply_setup.ps1
```

Il file e un bootstrap tecnico nascosto chiamato dall'installer. Non e il flusso utente.

Log:

```text
C:\Program Files\Security Center AI\runtime\installer-setup.log
```

Il log contiene riepilogo delle scelte, step eseguiti, output degli script tecnici e stack degli errori. Password SQL, `DB_PASSWORD`, `SECRET_KEY`, `PASSWORD` e `PWD` vengono mascherati prima della scrittura. Se il setup finale fallisce, l'installer propone di aprire subito questo file con Notepad.

La configurazione temporanea `runtime\installer-setup.json` viene rimossa al termine, anche in caso di errore gestito. Se il setup non viene completato, aprire il log e poi rilanciare l'installer oppure usare gli script tecnici dalla cartella installata con una sessione amministrativa.

## Database SQL Server TEST

SQL Server resta un prerequisito esterno: l'installer non installa SQL Server.

Se il server indicato nel wizard e locale e non risponde, il setup esegue discovery delle istanze SQL Server locali usando servizi Windows e registry SQL Server. Le istanze rilevate vengono provate in sequenza; se una si connette, `DB_HOST` viene aggiornato automaticamente nella `.env` locale.

Nel wizard e presente anche il pulsante **Rileva istanze SQL** nella schermata database. Il pulsante mostra le istanze locali rilevate da servizi Windows e registry SQL Server; selezionando una voce viene compilato il campo server SQL.

Database consigliato:

```sql
CREATE DATABASE [SecurityCenterAI_TEST];
```

Se nel wizard si seleziona la creazione automatica, il database viene creato solo con richiesta esplicita e solo se l'account usato ha permessi sufficienti. Usare solo account di test. Con autenticazione SQL, la password viene salvata nella `.env` locale installata e non deve essere incollata in ticket, documenti, email o chat.

## Accesso

URL locale:

```text
http://127.0.0.1:8000/
```

Da un altro PC nella stessa LAN:

```text
http://<PC-IP>:8000/
```

Verificare che `ALLOWED_HOSTS` includa l'IP LAN e che Windows Firewall consenta TCP 8000. Non creare pubblicazioni Internet, NAT pubblici o reverse proxy pubblici per questo deployment TEST.

## Uninstall

La disinstallazione dell'app resta gestita da Windows tramite "App installate" o dall'uninstaller Inno Setup. Durante uninstall, l'installer tenta di fermare e rimuovere il servizio `SecurityCenterAI`.

Lo standard uninstall non elimina il database SQL Server. Il database viene conservato intenzionalmente per evitare perdita dati.

La rimozione del database TEST e separata ed esplicita:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\drop_test_database.ps1
```

`drop_test_database.ps1` legge `DB_NAME` dalla `.env`, rifiuta nomi che non contengono `TEST` o `UAT` salvo `-ForceUnsafeName`, richiede conferma digitata e non viene mai eseguito automaticamente durante uninstall.

## Limiti

- Installer per test LAN, non produzione hardened.
- SQL Server resta il database target e deve essere gia disponibile.
- Python resta necessario per creare `.venv` finche non verra introdotto un runtime embedded.
- Il servizio usa Waitress, non `runserver`.
- Nessuna integrazione Microsoft Graph automatica: Graph richiede permessi Entra approvati; tenant, client ID e client secret si configurano dalla UI Microsoft Graph o da setting server dopo l'installazione. L'installer non include credenziali Graph.
- Nessuna integrazione IMAP.
- Nessun segreto reale incluso nel pacchetto o nell'installer.
- Nessun download automatico di WinSW o NSSM.
- Nessun requisito di build installer durante la test suite automatica.
