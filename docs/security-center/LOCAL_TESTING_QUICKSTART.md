# Local Testing Quickstart

Use these commands from the repository root to validate a local Security Center AI checkout with synthetic data only.

## Backend Checks

```powershell
python manage.py check
python manage.py test security
python manage.py seed_security_uat_demo --dry-run
python manage.py seed_security_uat_demo --reset
python manage.py seed_security_uat_demo
python manage.py security_uat_smoke_check
python manage.py makemigrations --check --dry-run
python manage.py runserver
```

Open Django at:

- Security UI: http://127.0.0.1:8000/security/
- Mailbox sources: http://127.0.0.1:8000/security/admin/mailbox-sources/
- Configuration API overview: http://127.0.0.1:8000/security/api/configuration/overview/

## Frontend Checks

```powershell
npm --prefix frontend run build
npm --prefix frontend run dev
```

Open Vite at:

- http://127.0.0.1:5173/
- http://127.0.0.1:5173/configuration
- http://127.0.0.1:5173/modules

## Avvio con frontend React servito da Django

Per testare un solo endpoint Django senza `npm run dev`:

```powershell
.\scripts\windows\build_frontend_for_django.ps1
python manage.py runserver 0.0.0.0:8000
```

Aprire:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/configuration
- http://127.0.0.1:8000/modules/watchguard
- http://127.0.0.1:8000/addons
- http://127.0.0.1:8000/reports

Le pagine SSR e admin restano sotto `/security/` e `/admin/`.
Vedere `docs/security-center/LOCAL_TEST_DEPLOYMENT.md` per il profilo Windows LAN con SQL Server di test.
Per un PC di test aziendale con script operatore Windows e pacchetto ZIP, vedere `docs/security-center/WINDOWS_TEST_PACKAGE.md`.

## UAT Demo Data

The UAT demo pack is synthetic and resettable:

```powershell
python manage.py seed_security_uat_demo --dry-run
python manage.py seed_security_uat_demo --reset
python manage.py seed_security_uat_demo
python manage.py security_uat_smoke_check
```

The seed command creates only `uat-demo-` mailbox sources, `[UAT DEMO]` runtime sources, `[UAT DEMO]` subjects, and safe pipeline summaries. It does not implement or call Microsoft Graph, IMAP, or external services.

## SQL Server Test Profile

SQLite remains the default for local development. For a Windows test PC that must use SQL Server or SQL Server Express, use the dedicated test profile:

```powershell
Copy-Item .env.test-sqlserver.example .env
notepad .env
```

Update only test values such as `DB_HOST` and `ALLOWED_HOSTS`, then validate:

```powershell
.\scripts\windows\check_sqlserver_test_db.ps1
python manage.py migrate
python manage.py security_db_check
python manage.py seed_security_uat_demo --reset
python manage.py seed_security_uat_demo
python manage.py security_uat_smoke_check
python manage.py runserver 127.0.0.1:8000
```

Use a dedicated database such as `SecurityCenterAI_TEST`; never point the test profile at production data.

For Windows SQL Server test deployments, prefer the guided wizard:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -TestConnection
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService
```

The database must already exist or be created only after an explicit `-CreateDatabase` request or interactive confirmation. Standard uninstall does not drop SQL Server data; optional test cleanup is handled separately by `scripts\windows\drop_test_database.ps1`.
For Windows service mode, place verified WinSW at `tools\windows\winsw.exe` before packaging; NSSM at `tools\windows\nssm.exe` is fallback only. No automatic download is performed, and the service uses Waitress rather than Django `runserver`.
See `docs/security-center/SQLSERVER_TEST_DEPLOYMENT.md` for the full Italian operator guide.
For the Windows test package workflow with setup/start/stop/open scripts, see `docs/security-center/WINDOWS_TEST_PACKAGE.md`.
