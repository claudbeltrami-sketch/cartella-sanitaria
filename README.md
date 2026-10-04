# cartella-sanitaria

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
