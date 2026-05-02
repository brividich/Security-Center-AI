# Windows service wrapper

WinSW e il wrapper servizio Windows preferito per Security Center AI.

Per installare Security Center AI come servizio Windows con WinSW, copiare l'eseguibile x64 verificato in questa cartella:

```text
tools\windows\winsw.exe
```

Durante l'installazione lo script genera anche la configurazione richiesta da WinSW accanto all'eseguibile:

```text
tools\windows\winsw.xml
```

Viene mantenuta una copia compatibile e leggibile come `tools\windows\SecurityCenterAI.xml`, ma il file operativo usato da WinSW deve avere lo stesso nome base dell'eseguibile.

Fonte consigliata: release ufficiali WinSW su GitHub. Verificare sempre provenienza, hash, licenza e approvazione alla redistribuzione prima di inserirlo nel pacchetto o nell'installer.

Non rinominare eseguibili non correlati in `winsw.exe`. Il file deve essere il binario WinSW atteso e verificato.

NSSM resta disponibile solo come fallback opzionale:

```text
tools\windows\nssm.exe
```

Fonte consigliata NSSM: release ufficiale NSSM pubblicata dal progetto NSSM. Anche per NSSM verificare provenienza, integrita, licenza e redistribuzione.

Lo script `scripts\windows\package_test_deployment.ps1` include automaticamente `tools\windows\winsw.exe` e, se presente, `tools\windows\nssm.exe` nel pacchetto Windows. Non viene eseguito alcun download automatico.

Il repository preferisce non versionare `winsw.exe` o `nssm.exe`: questi file sono opzionali, locali e ignorati da git. La responsabilita di licenza, provenienza, verifica e redistribuzione dei binari resta dell'operatore che prepara il pacchetto.

In alternativa ai file app-local, installare `winsw.exe` o `nssm.exe` nel `PATH` del sistema. Gli script cercano WinSW prima di NSSM.

I test automatici non richiedono `winsw.exe` o `nssm.exe`; gli script di installazione del servizio falliscono con un messaggio chiaro se nessun wrapper e disponibile.
