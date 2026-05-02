# Checklist Operatore UAT / Demo

Questa checklist serve a validare Security Center AI end-to-end usando solo dati sintetici. Non usare dati cliente, email reali, credenziali, indirizzi pubblici reali, dump di report o log operativi.

## A. Avvio Sistema

- Avviare Django:

```powershell
python manage.py runserver
```

- Avviare il frontend, se usato:

```powershell
npm --prefix frontend run dev
```

- Effettuare login con un utente autorizzato, se richiesto.
- Aprire Security Center AI e poi Configuration Studio.
- Confermare che l'ambiente sia di test e che i dati demo siano chiaramente marcati come `[UAT DEMO]`.

## B. Configuration Studio

- Verificare che la overview si carichi senza errori.
- Verificare che la tab sorgenti mostri le sorgenti demo:
  - WatchGuard EPDR Demo
  - WatchGuard ThreatSync Demo
  - WatchGuard Dimension / Firebox Demo
  - Microsoft Defender Vulnerability Demo
  - NAS / Synology Backup Demo
  - Custom Report Demo
- Verificare che le card sorgente mostrino stato, contatori e ultimo run.
- Aprire il wizard di configurazione sorgente.
- Usare il test configurazione con un campione sintetico incollato manualmente.
- Verificare che nessun dato demo sia presentato come dato reale quando e un placeholder.

## C. Module Workspace

- Verificare che `/modules` si apra.
- Aprire il workspace WatchGuard.
- Aprire il workspace Defender.
- Aprire il workspace Backup/NAS.
- Aprire il workspace Custom.
- In ogni workspace verificare, dove presenti, le tab:
  - Overview
  - Sorgenti
  - Report
  - KPI
  - Alert
  - Regole
  - Diagnostica
- Verificare che eventuali dati placeholder o demo siano riconoscibili come sintetici.

## D. Mailbox Ingestion

- Eseguire la simulazione senza scrittura:

```powershell
python manage.py seed_security_uat_demo --dry-run
```

- Pulire eventuali dati demo precedenti:

```powershell
python manage.py seed_security_uat_demo --reset
```

- Creare il dataset UAT demo:

```powershell
python manage.py seed_security_uat_demo
```

- Eseguire il controllo smoke:

```powershell
python manage.py security_uat_smoke_check
```

- Aprire le pagine sorgenti mailbox.
- Verificare i contatori dell'ultimo run.
- Verificare lo stato pipeline e la presenza di run `success`, `partial` e `failed` sintetici.

## E. Alert / Evidence / Ticket

- Verificare, se la logica e gia implementata, che la vulnerabilita critica Defender mostri o generi un alert critico sintetico.
- Verificare che il backup NAS completato non generi alert rumorosi.
- Verificare che il backup fallito o mancante mostri warning o alert, se supportato.
- Verificare che gli eventi WatchGuard low/closed non generino alert rumorosi.
- Verificare che evidenze e ticket, se presenti, siano deduplicati e riferiti solo a dati `[UAT DEMO]`.

## F. Controlli Sicurezza

- Verificare che non compaiano email reali.
- Verificare che non compaiano credenziali.
- Verificare che non compaiano webhook URL.
- Verificare che non compaiano API key.
- Verificare che i riepiloghi API non espongano corpo email o testo raw del report.
- Verificare che i dati demo siano marcati come sintetici con `[UAT DEMO]`, `uat-demo-`, `example.com`, `example.local`, host `EXAMPLE-HOST-*` e indirizzi RFC 5737.

## G. Limitazioni Note

- Il provider Microsoft Graph e' disponibile solo quando configurato lato server con credenziali dedicate e permessi approvati.
- Il provider IMAP non e ancora implementato.
- Alcuni dettagli KPI, report o alert dei moduli possono essere ancora placeholder.
- Il rule builder potrebbe non essere ancora modificabile.
- Le notifiche potrebbero non essere ancora completamente configurabili.
- Il pack UAT non effettua chiamate esterne e non valida connettivita reale verso mailbox o servizi cloud, salvo test manuali espliciti su una sorgente Graph configurata.
