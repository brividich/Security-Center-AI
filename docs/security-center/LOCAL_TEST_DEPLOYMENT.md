# Deployment locale di test

Questa guida descrive l'avvio di Security Center AI su un PC Windows di test con un solo endpoint Django in LAN. Il frontend React viene compilato una volta e poi servito da Django.

Questo non e un deployment production hardened. Usare solo in LAN, con dati sintetici o sanitizzati, e senza esporre il servizio su Internet.

Per il workflow operatore con un solo setup script, start/stop/restart/open e pacchetto distribuibile, vedere `docs/security-center/WINDOWS_TEST_PACKAGE.md`.

## Profilo SQL Server di test

Per usare SQL Server o SQL Server Express sul PC di test, partire dal profilo dedicato:

```powershell
Copy-Item .env.test-sqlserver.example .env
notepad .env
```

Impostare solo valori di test, ad esempio `DB_HOST`, `ALLOWED_HOSTS` e l'eventuale IP LAN del PC. Non inserire segreti reali in file tracciati.

Validare il profilo:

```powershell
.\scripts\windows\check_sqlserver_test_db.ps1
python manage.py security_db_check
```

Per i dettagli completi vedere `docs/security-center/SQLSERVER_TEST_DEPLOYMENT.md`.

## Build del frontend React

Dal repository root:

```powershell
.\scripts\windows\build_frontend_for_django.ps1
```

Lo script verifica Node/npm, installa le dipendenze frontend se `frontend/node_modules` manca, esegue:

```powershell
npm --prefix frontend run build
```

e controlla che esista `frontend/dist/index.html`.

## Avvio Django

Applicare eventuali migrazioni sul database di test, poi avviare Django:

```powershell
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Dal PC locale aprire:

```text
http://127.0.0.1:8000/
```

Da un altro PC in LAN aprire:

```text
http://<PC-IP>:8000/
```

L'app React deve aprirsi da Django senza `npm run dev`. Le pagine SSR Django restano disponibili sotto `/security/` e l'admin Django sotto `/admin/`.

## Rotte SPA da verificare

Dopo la build, aggiornare il browser direttamente su queste rotte:

- `http://127.0.0.1:8000/configuration`
- `http://127.0.0.1:8000/modules`
- `http://127.0.0.1:8000/modules/watchguard`
- `http://127.0.0.1:8000/modules/microsoft-defender`
- `http://127.0.0.1:8000/modules/backup-nas`
- `http://127.0.0.1:8000/modules/custom`
- `http://127.0.0.1:8000/addons`
- `http://127.0.0.1:8000/reports`

Verificare anche che le rotte backend non siano intercettate dal frontend:

- `http://127.0.0.1:8000/security/`
- `http://127.0.0.1:8000/security/admin/mailbox-sources/`
- `http://127.0.0.1:8000/security/api/configuration/overview/`
- `http://127.0.0.1:8000/admin/`

## Build mancante

Se `frontend/dist/index.html` non esiste, Django mostra una pagina HTML amichevole in italiano con il comando:

```powershell
npm --prefix frontend run build
```

Non viene sollevato un errore `FileNotFoundError`.

## Limiti noti

- Questo profilo e per test locale o LAN, non per produzione esposta a Internet.
- Per un PC di test aziendale con SQL Server e script operatore Windows, usare `docs/security-center/WINDOWS_TEST_PACKAGE.md`.
- Non include installer Windows.
- Non abilita Microsoft Graph o IMAP.
- Non sostituisce un reverse proxy o una configurazione hardened.
- La build React viene servita da Django da `frontend/dist/`; in caso di nuova build riavviare Django se necessario.
