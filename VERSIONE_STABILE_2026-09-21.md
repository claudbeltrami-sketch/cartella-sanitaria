# LUMEN — Versione di riferimento del 21 settembre 2026

## Codice conservato

- Commit applicativo: `1e239188c361452344fbddad494b66b6f147ff0a`.
- Build: `20260921-firma-trasporto-v6`.
- Ramo di conservazione: `stabile-2026-09-21-firma-automatica`.
- Il ramo nasce dal commit applicativo esatto; questa nota è l'unica aggiunta. Il codice applicativo non è stato modificato per creare il punto di ripristino.

## Prova reale confermata

Il 21 settembre 2026 l'utente ha confermato che la firma acquisita su iPhone è arrivata automaticamente sul Mac, senza importazione manuale. Lo screenshot fornito mostra la firma di prova nel PDF, nel campo Presa visione il lavoratore, con data 21/09/2026. Questo conferma il percorso acquisizione, trasferimento automatico e inclusione nel PDF per la prova effettuata. Non costituisce un collaudo generale di ogni funzione o rete.

## Evidenze tecniche già disponibili per il commit

- GitHub Pages: pubblicazione riuscita, run 35576305160.
- Verifica stampa cartella A4: riuscita, run 35576308602.
- Correzione del trasporto PeerJS: serializzazione binaria con frammentazione; test di regressione incluso in tests/signature-transport.cjs.
- I workflow storici patch-audiometria.yml e patch-audiometria-v2.yml risultano in errore anche su questa revisione. Non sono stati corretti in questo salvataggio e non si dichiara che tutti i workflow siano verdi.

## Regola di conservazione

Conservare questo ramo come riferimento del percorso firme funzionante. Preparare ogni futura modifica su un ramo separato, eseguire i controlli pertinenti e ottenere una nuova prova reale del percorso firme prima di sostituire il riferimento. Non aggiungere funzioni alla versione operativa prima della sessione prevista del 28 settembre senza una nuova richiesta esplicita.

## Ripristino e limiti

Per tornare a questo codice usare il commit applicativo indicato, mantenendo la storia Git e verificando la pubblicazione GitHub Pages. Non sovrascrivere o cancellare i dati locali del browser durante un ripristino del programma.

Questo punto di ripristino conserva sorgenti, dipendenze incluse e test del repository. Non contiene gli archivi sanitari, le firme o i PDF memorizzati sul Mac/iPhone: non sono stati acquisiti da remoto né ne è stato verificato il backup o il ripristino su USB.
