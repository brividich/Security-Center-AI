# Policy artefatti di deployment

Questa policy definisce cosa deve stare in Git e cosa deve restare locale quando si prepara un pacchetto o installer di test di Security Center AI.

## Cosa va in Git

Devono restare tracciati:

- codice Django, React e TypeScript sorgente;
- migrazioni Django;
- script correnti in `scripts/windows/`;
- file Inno Setup sorgente in `installer/windows/`;
- documentazione operativa in `docs/security-center/`;
- esempi sanitizzati, fixture di test e `.env.example`;
- `.env.test-sqlserver.example`, che contiene solo valori placeholder per test.

Non aggiungere dati reali, host reali, tenant reali, credenziali, report operativi o output generati.

## Cosa deve restare locale

Devono restare fuori da Git:

- `.env` e qualunque `.env.*` non esplicitamente approvato;
- `.venv/`, `venv/`, `node_modules/` e cache locali;
- `runtime/`, inclusi log e configurazioni temporanee del setup installer;
- `dist/`, `frontend/dist/`, ZIP e installer `.exe`;
- database locali come `db.sqlite3`, `*.sqlite3` e `*.db`;
- log, upload, mailbox, inbox, report generati e `security_raw_inbox/`;
- wrapper binari locali come `tools/windows/winsw.exe` e `tools/windows/nssm.exe`;
- XML generati dal wrapper servizio, `tools/windows/winsw.xml` e copia compatibile `tools/windows/SecurityCenterAI.xml`.

Questi file possono contenere dati locali, segreti, output pesanti o binari di terze parti. Non devono essere committati.

## WinSW e NSSM

WinSW e il wrapper servizio Windows preferito. Per includerlo in un pacchetto locale:

```powershell
Copy-Item C:\path\to\verified\winsw.exe .\tools\windows\winsw.exe
```

NSSM resta fallback opzionale:

```powershell
Copy-Item C:\path\to\verified\nssm.exe .\tools\windows\nssm.exe
```

Usare solo binari verificati da fonti ufficiali, controllando origine, hash, licenza e diritto di redistribuzione. Gli script non scaricano automaticamente WinSW o NSSM e `.gitignore` impedisce di committarli per errore. `tools/windows/README.md` invece resta tracciato e documenta il posizionamento atteso.

## Build pacchetto e installer

Il frontend React viene compilato in:

```text
frontend/dist/
```

Il pacchetto Windows TEST viene generato in:

```text
dist/SecurityCenterAI-Test-<version>/
```

L'installer Inno Setup viene generato in:

```text
dist/installer/
```

Comandi tipici:

```powershell
npm --prefix frontend run build
powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version current -Force
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_installer.ps1 -Version current
```

Gli output restano locali e ignorati. Se un file sotto `dist/` compare in `git status`, rimuoverlo dall'indice con `git rm --cached` senza cancellare la copia locale.

Per rimuovere solo vecchie versioni di pacchetti e installer mantenendo la versione corrente dichiarata in `frontend/package.json` o `README.md`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -OldInstallerVersionsOnly
```

Per mantenere una versione specifica:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -OldInstallerVersionsOnly -KeepVersion 0.6.2
```

## Perche `.env` e database sono esclusi

`.env` puo contenere password SQL, chiavi Django, host locali e altri segreti. I database locali possono contenere dati di test, cache applicative o record importati. Entrambi sono specifici della macchina e non devono entrare in repository.

Usare gli esempi tracciati:

- `.env.example`
- `.env.test-sqlserver.example`

Poi creare la configurazione locale sul PC di test con gli script guidati.

## Pulizia locale sicura

Per vedere cosa verrebbe rimosso:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -DryRun
```

Per rimuovere solo artefatti generati standard:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1
```

Per includere cartelle piu pesanti o sensibili servono flag espliciti:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -IncludeNodeModules
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -IncludeLogs
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -IncludeLocalTools
```

La rimozione di `.env` e database richiede conferma esplicita. Non usare questi flag su macchine con dati non ricreabili o non sanitizzati.
