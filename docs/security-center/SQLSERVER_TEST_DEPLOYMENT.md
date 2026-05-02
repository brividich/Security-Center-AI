# Profilo TEST con SQL Server

Questa guida serve per installare Security Center AI su un PC di test Windows usando SQL Server o SQL Server Express gia disponibile nell'ambiente aziendale.

Il profilo e solo per test locale o LAN. Non usare database di produzione, non salvare segreti reali in Git e non esporre il server Django su Internet.

Per il pacchetto TEST Windows con script `setup`, `start`, `stop`, `restart`, `open` e packaging ZIP, vedere `docs/security-center/WINDOWS_TEST_PACKAGE.md`.

## Prerequisiti

- SQL Server o SQL Server Express installato sul PC di test o su un host SQL raggiungibile in LAN.
- ODBC Driver 18 for SQL Server installato su Windows.
- Ambiente Python del progetto configurato.
- Database dedicato, separato da qualunque ambiente reale: `SecurityCenterAI_TEST`.

## Creazione database

Eseguire in SQL Server Management Studio o in uno strumento equivalente, usando un account amministrativo locale o di test:

```sql
CREATE DATABASE SecurityCenterAI_TEST;
```

Il wizard controlla prima la connessione all'istanza SQL Server, poi verifica se `DB_NAME` esiste. Il DB deve esistere oppure puo essere creato solo con richiesta esplicita dell'operatore. Se il database manca, il wizard mostra un messaggio chiaro, propone la creazione solo in modalita interattiva o con `-CreateDatabase`, e in caso di rifiuto o permessi insufficienti stampa lo script manuale:

Se l'host configurato e locale e non risponde, il wizard esegue discovery delle istanze SQL Server locali tramite servizi Windows e registry SQL Server. Le istanze rilevate vengono provate in sequenza; quando una connessione riesce, `DB_HOST` viene aggiornato nella `.env`.

La schermata database dell'installer include anche il pulsante **Rileva istanze SQL**. Usarlo per popolare la lista delle istanze locali disponibili e selezionare il server corretto prima di continuare.

```sql
CREATE DATABASE [SecurityCenterAI_TEST];
```

Con autenticazione Windows non e necessario creare un login SQL dedicato, se l'utente Windows che avvia Django ha permessi sul database.

Alternativa con login SQL, solo con valori placeholder:

```sql
CREATE LOGIN security_center_test WITH PASSWORD = '<CHANGE_ME_STRONG_PASSWORD>';
USE [SecurityCenterAI_TEST];
CREATE USER security_center_test FOR LOGIN security_center_test;
ALTER ROLE db_owner ADD MEMBER security_center_test;
```

## Configurazione guidata `.env`

Dal repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -TestConnection
```

Creazione esplicita del database e migrazioni:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -CreateDatabase -TestConnection -RunMigrations
```

Il wizard crea `.env` da `.env.test-sqlserver.example` se manca, aggiorna solo le chiavi SQL Server/deployment gestite e conserva le altre chiavi manuali. Se `.env` esiste gia, chiede conferma prima di modificarla.

Inserire:

- `DB_HOST`: istanza SQL Server, ad esempio `localhost\SQLEXPRESS`.
- `DB_NAME`: database SQL Server di test, ad esempio `SecurityCenterAI_TEST`.
- autenticazione Windows/Trusted Connection oppure autenticazione SQL.
- `ALLOWED_HOSTS`: aggiungere l'indirizzo LAN del PC di test al posto di `<LAN_IP>`.
- porta applicazione, default `8000`.

Con autenticazione SQL, la password viene richiesta con input sicuro e non viene stampata. La password viene comunque salvata localmente nella `.env`.

Uso non interattivo con valori di test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -DbHost "localhost\SQLEXPRESS" -DbName "SecurityCenterAI_TEST" -TrustedConnection True -AllowedHosts "127.0.0.1,localhost" -Port 8000 -DebugMode True -Force -TestConnection
```

Il supporto manuale resta disponibile:

```powershell
Copy-Item .env.test-sqlserver.example .env
notepad .env
```

Non committare `.env` e non inserire segreti reali in file tracciati da Git.

## Validazione profilo

Controllare driver, variabili e connessione Django:

```powershell
.\scripts\windows\check_sqlserver_test_db.ps1
```

Oppure eseguire direttamente:

```powershell
python manage.py security_db_check
```

Il comando stampa motore, vendor, nome database, esito connessione, `SELECT 1` e stato migrazioni. Non stampa password.

## Migrazioni e demo

Applicare lo schema sul database di test:

```powershell
python manage.py migrate
python manage.py security_db_check
```

Caricare dati sintetici dimostrativi:

```powershell
python manage.py seed_security_uat_demo --reset
python manage.py seed_security_uat_demo
```

Eseguire lo smoke check:

```powershell
python manage.py security_uat_smoke_check
```

Oppure usare il setup Windows con configurazione guidata, migrazioni, seed e servizio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo -InstallService
```

Comando consigliato quando il database TEST deve essere creato dal setup con permessi sufficienti:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService
```

Avviare il server solo per localhost o LAN di test:

```powershell
python manage.py runserver 127.0.0.1:8000
```

Per accesso da un altro PC in LAN, usare l'IP LAN del PC di test solo se la rete e il firewall locale lo consentono:

```powershell
python manage.py runserver <LAN_IP>:8000
```

## Avvertenze operative

- Non usare database di produzione.
- Non riutilizzare credenziali aziendali reali nei file del repository.
- Non pubblicare il servizio su Internet.
- Usare solo dati sintetici o esempi sanitizzati.
- Conservare SQLite per sviluppo locale rapido lasciando `DB_ENGINE` non impostato o impostato a `sqlite`.
- Per operatori che non usano VS Code, preferire il workflow documentato in `docs/security-center/WINDOWS_TEST_PACKAGE.md`.

## Disinstallazione e retention database

Lo standard uninstall non elimina il database SQL Server. La disinstallazione Windows rimuove i file applicativi installati e tenta di fermare/rimuovere il servizio `SecurityCenterAI`, ma il database viene conservato intenzionalmente per evitare perdita dati.

La rimozione del database TEST e una procedura separata ed esplicita:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\drop_test_database.ps1
```

`drop_test_database.ps1` legge `DB_NAME` dalla `.env`, rifiuta nomi che non contengono `TEST` o `UAT` salvo `-ForceUnsafeName`, mostra host e database, richiede conferma digitata nel formato `DROP <DB_NAME>` e non viene mai eseguito automaticamente durante uninstall.
