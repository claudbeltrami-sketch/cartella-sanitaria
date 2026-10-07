# cartella-sanitaria

## Committente e datore di lavoro — 7 ottobre 2026

La cartella conserva `committente` separato da `datore_lavoro`. La sessione
precompila il committente delle nuove visite; l'apertura di un'altra cartella
non eredita il committente della sessione attiva. Le liste possono avere una
colonna COMMITTENTE. Il conteggio usa il campo esplicito quando disponibile.

Archivio e elenco visite hanno filtri indipendenti e combinabili per
committente e datore. L'elenco applica i filtri di ruolo alla versione della
visita nella data scelta, anche quando il lavoratore ha cambiato azienda.
Una modifica ai filtri invalida la selezione precedente prima dell'esportazione.
Il PDF elenco mostra entrambi i ruoli; il certificato riporta il datore.
I controlli amministrativi non modificano l'impaginazione della cartella stampata.

Le vecchie diciture con prefisso SERMOLAB o ORIZZONTE/GRUPPO ORIZZONTE
vengono separate in lettura. La dicitura originale resta disponibile e viene
conservata nel salvataggio successivo, insieme allo storico precedente.
Una sede Orizzonte viene rimossa dal campo datore solo se precede una
ragione sociale esplicita con suffisso SRL. Le assegnazioni amministrative
possono integrare un committente assente soltanto per la medesima data visita.
Nessuna migrazione massiva: ricerca, apertura e PDF non riscrivono il database.
Le denominazioni incomplete restano da completare; non dedurre aziende da
nomi di persone, date o sedi. Per i casi dubbi consultare i certificati già
inviati, confrontando identità e data; il cartaceo prevale nelle discordanze.
Raccogliere i dubbi residui per il referente. Nessun documento personale
viene incluso nel codice o nelle prove.

Collaudi su dati sintetici e archivi isolati: `tests/ruoli-azienda.cjs`,
`tests/ruoli-azienda-browser.cjs`, `tests/visite-filtro.cjs`,
`tests/visite-archivio.cjs`, `tests/allegati-dom.cjs`,
`tests/conteggio-automatico.cjs`, `tests/conteggio-committenti.cjs`.
Verificati anche PROVA FANTASMA, backup/ripristino, conservazione storico,
certificato e PDF, interfaccia Chromium mobile 390px e desktop.
WebKit/Safari e dispositivi dell'utente non verificati in questo collaudo.

Preparazione sul ramo `fix/committente-datore-20261007`. Prima dell'attivazione
operativa serve il backup completo aggiornato del dispositivo, come previsto
dalla memoria operativa. Base stabile: `a46d5187ee02ea0cf29b0c6c18d516a669677054`.
Rollback del codice tramite annullamento del commit; i campi originali e lo
storico rimangono conservati. Le cartelle locali non sono accessibili da questo
ambiente: il collaudo non certifica il contenuto dell'archivio dell'utente.

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
