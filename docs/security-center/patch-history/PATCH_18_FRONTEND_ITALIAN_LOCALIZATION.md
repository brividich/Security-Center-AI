# Patch 18 - Frontend Italian Localization Sweep

## Scope

Patch 18 ha rivisto le stringhe utente del frontend React/Vite sotto `frontend/src/` per rendere la console piu coerente con il backend/SSR in italiano. La patch non cambia contratti API, route, enum inviati al backend, chiavi TypeScript, codici parser o logica business.

## File rivisti

- `frontend/src/pages/*`
- `frontend/src/components/layout/*`
- `frontend/src/components/tables/*`
- `frontend/src/components/configuration/*`
- `frontend/src/components/modules/*`
- `frontend/src/data/mockData.ts`
- `frontend/src/data/configurationStudioMock.ts`
- `frontend/src/data/moduleWorkspaceMock.ts`
- `frontend/src/services/api.ts`
- `frontend/src/services/securityApi.ts`
- `frontend/src/services/moduleWorkspaceApi.ts`
- `frontend/src/utils/moduleAggregation.ts`

## Stringhe tradotte

- Navigazione: Cruscotto, Registro add-on, Inbox eventi, Segnali asset, Report, Evidenze, Regole, Configurazione.
- Pagine e sezioni: Studio Configurazione, Area Modulo, Panoramica, Esplora report, Pipeline di ingestione, Diagnostica.
- Stati e badge: Attivo, Disabilitato, Attenzione, Configurazione errata, In attesa, Soppresso, Critico, Alto, Medio, Basso.
- Azioni e metriche: Ultima importazione, Ultima esecuzione, Alert generati, Elementi operativi, Apri modulo, Configura sorgenti, Vedi alert.
- Sicurezza: Vulnerabilita critica, Dispositivi esposti, Ticket di remediation, Backup fallito, Backup mancante, Riduzione rumore, Evidence Container.
- Dati mock/demo: descrizioni, motivazioni, raccomandazioni e fallback visibili in italiano.

## Stringhe lasciate in inglese

- Nomi prodotto/vendor: WatchGuard, Microsoft Defender, Synology, ThreatSync, EPDR, Firebox.
- Termini tecnici comuni o richiesti: KPI, Alert, Parser, Pipeline, Dashboard quando parte di nomi esistenti, Evidence Container.
- Codici, route, enum, campi API, nomi tipo e valori interni: per non rompere contratti frontend/backend.
- Titoli di report vendor dimostrativi come `EPDR Executive Report`, `ThreatSync Incident List`, `SSL VPN Allowed CSV`: mantenuti come nomi di report/prodotto.
- Esempi pseudo-query nelle viste regole, ad esempio `source=... AND status=Warning`: lasciati come sintassi tecnica dimostrativa.

## Build

- `npm --prefix frontend run build` - OK, con warning Vite esistente sui chunk oltre 500 kB.
