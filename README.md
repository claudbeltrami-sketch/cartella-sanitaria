# cartella-sanitaria

## Backup automatico durante l’uso — PROVA, 5 ottobre 2026

Implementazione sul ramo `backup-automatico-mac-20261005`, da promuovere solo
dopo il backup aggiornato del dispositivo operativo. Base stabile: `c8cd452`.
Nessuna cartella reale del Mac è accessibile dai test; nessun backup del Mac è
stato eseguito da questo ambiente.

In ALTRI COMANDI → BACKUP AUTOMATICO, attivazione esplicita per ciascuna
sessione/scheda. Copia immediata, poi ogni 30 minuti mentre la pagina è visibile;
al ritorno da una pausa viene eseguita l’eventuale copia scaduta. Chiusura e
ricarica disattivano la funzione. Nessuna cancellazione automatica delle copie.
Usare una sola scheda e una cartella locale non sincronizzata.

Con `showDirectoryPicker`, scrittura nella cartella scelta e rilettura completa
prima della conferma. Senza questa API, download periodici: il browser può
richiedere autorizzazione o conferma; l’interfaccia dichiara sempre che il
salvataggio su disco non è verificato. Non cambiare browser senza prima
trasferire il backup, perché gli archivi sono separati.

Backup manuale e automatico condividono il formato V1. Inclusi ora anche i
consensi cartacei, prima omessi. I vecchi backup privi di questo campo restano
leggibili e non cancellano i consensi esistenti. Il ripristino ferma il timer;
un backup automatico in corso impedisce il ripristino. PROVA e reale mantengono
archivi e file marcati separati. Nessun salvataggio automatico altera le
cartelle cliniche, lo storico o la cartella aperta.

Verifiche: `tests/backup-automatico.cjs` (timer, file distinti, download, rilettura,
permessi revocati, disco pieno, file corrotto, ripristino storico/allegati/consensi,
compatibilità V1, isolamento PROVA e riapertura); `tests/backup-automatico-browser.cjs`
(download reale e ripristino in archivio vuoto, interfaccia Chromium, esclusione
dalla stampa); `tests/allegati-dom.cjs`; `tests/visite-filtro.cjs` (PDF e certificati
filtrati). Dati sintetici soltanto. Il selettore nativo e il disco del Mac non
sono stati verificati: il percorso cartella usa un handle simulato nel test.
WebKit/Safari non collaudato; il ramo download è collaudato in Chromium senza API
cartella. Per i test Node sono necessari jsdom, fake-indexeddb e jspdf; per il
browser Playwright e Chromium (`CHROMIUM_EXECUTABLE_PATH` opzionale).

## Elenco visite e ricerca archivio — 4 ottobre 2026

L'elenco conserva la ricerca già applicata nell'archivio (azienda, nominativo,
CF o altri termini) e vi aggiunge la data clinica scelta, incluse le versioni
storiche. Il filtro attivo è mostrato nella finestra. Una ricerca senza
risultati non viene mai sostituita dall'intero archivio. La data scelta resta
disponibile alla riapertura; il committente resta l'intestazione dell'output,
ora indicata esplicitamente. PDF e certificati usano solo le righe selezionate.
Nessuna migrazione o riscrittura delle cartelle è introdotta da questa modifica.

Verifiche con dati sintetici: `tests/visite-filtro.cjs` (24 visite, CBV 6,
ricerca combinata 4, storico, data, PDF, certificati, filtri vuoti, CF e modalità
PROVA FANTASMA); `tests/visite-archivio.cjs`; `tests/allegati-dom.cjs`
(persistenza, backup e ripristino). `tests/visite-filtro-browser.cjs` verificato
in Chromium a 390 × 844. WebKit non eseguito per dipendenze di sistema mancanti.
Il test preesistente `tests/omonimi.cjs` fallisce anche sul commit precedente
396ca70 nel confronto dell'archivio dopo riapertura; la correzione del filtro
non modifica quel comportamento. Ritorno disponibile sul ramo
`backup/elenco-prima-filtro-20261004`. Prima di aggiornare il dispositivo,
esportare il suo backup completo; i dati del dispositivo non sono accessibili
da questo collaudo.

## Percentuali spirometriche — 3 ottobre 2026

FVC e FEV1 in litri; PEF con unità esplicita L/s o L/min. Le percentuali
vuote si calcolano dalle equazioni ERS/ECSC 1993 (Quanjer et al., tabella 6),
con sesso, altezza e anni compiuti alla data del giudizio (in mancanza, data
cartella). Tra 18 e 25 anni si usa 25 come indicato nella fonte.

Fonte: https://doi.org/10.1183/09041950.005s1693

Le equazioni si riferiscono ad adulti di discendenza europea, 18–70 anni,
altezze 155–195 cm negli uomini e 145–180 cm nelle donne. Fuori da questi
intervalli viene mostrata e stampata una nota di estrapolazione. Sotto 18
anni, oltre 100 anni, con altezza fuori 120–220 cm o dati mancanti/invalidi
non viene prodotto un nuovo calcolo. Le percentuali manuali restano disponibili.
Non vengono aggiunti LLN o Z-score né sostituite le equazioni con GLI.

Percentuale = misura / predetto × 100, arrotondata all'intero. Le equazioni
pubblicate non certificano un'identità con il firmware SP10: ad esempio
2,76 L su un predetto di 2,86 L produce 96,50%, arrotondato a 97%. Una
percentuale 96 già inserita resta 96. Non si alterano coefficienti per
inseguire differenze di arrotondamento dello strumento.

Le percentuali precedenti senza metadati sono considerate inserite, mai
sovrascritte dal ricalcolo ordinario. Anche una correzione manuale vuota
resta tale. Il campo locale `spirometria_calcolo` conserva origine e
riferimento; l'apertura non riscrive l'archivio. Il pulsante esplicito
RICALCOLA LE TRE % riattiva il calcolo su tutti e tre i campi. I vecchi PEF
senza unità conservano la convenzione preesistente (>25: L/min).

In PROVA FANTASMA la data di nascita resta vuota e bloccata per preservare
l’identità fittizia. Il campo esplicito «Età di prova (anni)» permette di
provare le percentuali insieme a sesso e altezza. L’età viene conservata
solo nella cartella di prova; il calcolo è etichettato SIMULAZIONE e questo
campo non viene mai usato nelle cartelle ordinarie. Il pulsante segnala i
dati mancanti o non validi, anche quando non è ancora stata inserita alcuna
misura. Non vengono introdotti valori anagrafici impliciti.

Verifiche: `node tests/spirometria-percentuali.cjs`,
`node tests/spirometria-prova.cjs` e
`node tests/print-exams.cjs` con Playwright Chromium/WebKit. Dati sintetici:
calcolo, percentuali precedenti/manuali, passaggio tra cartelle,
serializzazione, unità, date, valori invalidi, ciclo di stampa e PDF al 125%.
