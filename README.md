# cartella-sanitaria

## Backup leggero e PDF separati sul Mac — 14 ottobre 2026

`ARCHIVIO PDF SUL MAC`, visibile nel pannello backup, salva tutti gli allegati
nella cartella `LUMEN_ALLEGATI`. Nei browser con File System Access il pulsante
sceglie una sola destinazione, scrive i file e li rilegge. Negli altri browser
si scarica uno ZIP senza compressione, si estrae nel Finder e si seleziona la
cartella estratta con il controllo di selezione cartella. Nessun file è inviato
in rete. I nomi sul disco comprendono SHA-256 e nome originale normalizzato;
il nome originale, il lavoratore e la visita restano nei metadati.

Solo quando **tutti** i file sono stati riletti e confrontati per dimensione e
SHA-256, una transazione sostituisce i Blob con riferimenti. File mancanti,
alterati, scritture fallite, modifiche concorrenti o errori della transazione
lasciano le copie incorporate intatte. Un file già esistente ma diverso non
viene sovrascritto. Gli indici JSON sono aggiunti senza sostituire gli indici
precedenti. La funzione non cancella mai file dalla cartella del Mac.

Il backup ordinario dall'interfaccia è `BELTRAMI_BACKUP_LEGGERO_V2`: include
cartelle, storico, firme, liste, risultati OCR e riferimenti, senza i documenti
clinici già separati. La cartella PDF deve essere copiata separatamente sulla
chiavetta. I file sorgente delle liste restano inclusi. Il backup leggero è
bloccato se ci sono ancora documenti clinici incorporati o collegamenti non
validi: non omette silenziosamente file non trasferiti. I browser con cartella
scrivibile già autorizzata salvano lì anche i nuovi allegati; negli altri casi
li conservano incorporati finché si completa nuovamente la separazione.

Il ripristino V2 richiede questa versione di LUMEN: le versioni precedenti lo
rifiutano, evitando di trattarlo come un backup completo. È utilizzabile senza
la cartella PDF collegata, anche su un altro dispositivo. Non elimina eventuali
file ancora incorporati sul dispositivo di destinazione; eventuali conflitti
bloccano il ripristino prima delle modifiche. Per aprire o rileggere i PDF si
ricollega la stessa cartella. I browser compatibili conservano il permesso in
un database locale separato; il permesso può essere revocato o scadere e non
viene incluso nei backup. La modalità PROVA usa un database distinto.

`BACKUP COMPLETO CON PDF` nel pannello rimane disponibile: richiede accesso ai
PDF esterni e produce il formato V1 precedente completo. Il vecchio esportatore
`backup-locale.html` si ferma se incontra collegamenti esterni e indirizza al
pannello LUMEN; non produce un falso backup completo senza PDF. Il marcatore
`lumen-external-pdf-build` identifica la funzione. Il marcatore di ricaricamento
automatico preesistente resta invariato per non interrompere cartelle aperte.

Collaudi con dati sintetici: `tests/allegati-esterni.cjs` verifica ZIP/CRC,
integrità, migrazione, modifiche concorrenti, errore di transazione e rollback,
conservazione di cartelle/storico/OCR, ripristino senza cartella collegata,
ricollegamento, copia completa e riferimenti malevoli. Il test
`tests/allegati-esterni-directory.cjs` simula la capacità di accesso alla cartella,
scritture fallite, permesso revocato, nuovi allegati e isolamento PROVA.
`tests/allegati-dom.cjs` e `tests/backup-stream.cjs` verificano la compatibilità
precedente, comprese copie oltre 64 MiB. Il test browser è disponibile in
`tests/allegati-esterni-browser.cjs`, ma non è stato eseguito con successo in
questo ambiente perché Chromium non può aprire socket. Selezione nativa,
Safari e dispositivi fisici richiedono verifica sul dispositivo; la migrazione
non parte automaticamente e conserva i file sorgente in caso di errore.


## Certificato PDF unico A4 — 13 ottobre 2026

Il certificato non viene più fotografato dalla pagina responsive e stirato
sull'A4. `certificato-pdf.js` compone testo e barcode vettoriali in punti PDF,
con metriche Helvetica fisse e firme incorporate nelle proporzioni originali.
Legge una copia dei campi già popolati del certificato, senza reinterpretare
i dati clinici né modificare l'archivio. La libreria PDF è locale.

Il pulsante singolo, i certificati dall'archivio, il pulsante cumulativo della
sessione e l'opzione stampantina usano lo stesso generatore. I batch ripristinano
la cartella aperta anche in caso di errore. Non vengono aggiunti timestamp o
identificatori casuali al PDF: stessi campi, firme e versione del modello
producono gli stessi byte. L'anteprima HTML resta adattabile allo schermo;
il documento da salvare, stampare o inviare è il PDF del pulsante dedicato.

Contenuti troppo lunghi per un A4, immagini illeggibili e caratteri non
supportati impediscono l'esportazione con un messaggio esplicito: nessun campo
o firma viene troncato o sostituito silenziosamente. La modalità PROVA conserva
la dicitura di prova. Le copie PDF già scaricate non vengono modificate.
Il marcatore `lumen-certificate-build` identifica la versione `20261013-a4-1`;
non viene forzato un ricaricamento sulle cartelle aperte.

Collaudo: `node tests/certificato-pdf.cjs` con Playwright Chromium 134 e WebKit
18.4 su Linux, viewport desktop 1440 px e mobile 390 px, densità 1/3 e fusi
orari differenti. Con dati sintetici, PDF singoli identici byte per byte in
tutte le configurazioni e nelle generazioni ripetute; stessa identità del file
anche per la stampantina. Verificati batch sessione/archivio, firme distinte,
periodicità personalizzata, ripristino dopo errore, prescrizioni su più righe,
barcode, immagini, A4 e assenza di testo fuori margine. Verifica selezione
storica con `node tests/visite-filtro.cjs`. I dispositivi fisici dell'utente
non sono accessibili da questo collaudo. Le dipendenze dei test restano quelle
dei test browser/DOM esistenti; `WEBKIT_EXECUTABLE_PATH` permette un runtime
WebKit locale e `CHROMIUM_ONLY=1` limita il test a Chromium.

## Stampa lista e dati sessione — 12 ottobre 2026

PDF LISTA usa i valori correnti della sessione, conservati localmente a ogni
modifica anche in preparazione. La stampa leggeva invece prima la copia
salvata, ignorando eventuali modifiche nei campi; senza SALVA E AVVIA i campi
non venivano conservati dopo un ricaricamento.

Preparazione e chiusura aprono entrambe un documento separato dalla cartella.
La preparazione mantiene Esito e Note vuoti. Le sedute con aziende diverse
possono essere avviate senza un'azienda unica se ogni lavoratore ha il datore.
Una sessione mancante viene recuperata solo dalla medesima lista attiva,
con stesso file e stesse identità nell'ordine originale; nessuna deduzione da
cartelle o liste estranee. I dati già persi e non salvati non sono ricostruibili.
NUOVA SESSIONE conserva una bozza vuota per non recuperare la sessione precedente.

Il marcatore `lumen-list-build` identifica questa correzione. Il marcatore
usato dalle vecchie pagine per il ricaricamento automatico resta invariato,
per non provocare la perdita di campi non salvati su una scheda già aperta.

Collaudi: `tests/lista-sessione.cjs` (app completa con archivi sintetici),
`tests/lista-sessione-browser.cjs` (Chromium mobile 390 px, 14 lavoratori,
riapertura, documento separato, pulsante stampa e PDF A4 orizzontale di una pagina).
Controllati mantenimento di cartelle/firme, file originale ed esiti.
La stampa nativa su Safari/iPhone non è stata eseguita in questo ambiente.
Nessun dato sanitario reale è incluso nei test.


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

### Scadenzario visite (13 ottobre 2026)

Il pulsante **SCADENZARIO** legge l'archivio locale del dispositivo, incluse le
versioni storiche, per tutti i committenti indicati nelle cartelle, senza elenco prestabilito. Il filtro si aggiorna automaticamente a ogni apertura o aggiornamento dello scadenzario. Mostra l'ultima visita per
identità (CF, oppure anagrafica completa), committente e azienda. Una visita più
recente sostituisce la scadenza precedente anche se la nuova data è da completare;
le revisioni della stessa visita non duplicano le righe. Le nomine sono escluse.

La prossima scadenza usa prima `prossima_visita`, se esplicita; altrimenti somma
alla data della visita la periodicità **registrata** (annuale, biennale,
quinquennale, semestrale, intervalli esatti in mesi/anni/giorni). Non assume mai
una periodicità assente. Fine mese e 29 febbraio sono limitati all'ultimo giorno
valido del mese di destinazione. Un valore esplicito invalido richiede correzione,
senza nasconderlo mediante il calcolo. La provenienza è visibile in tabella/PDF.

La data proposta è modificabile su ogni riga tramite **SALVA DATA**. Il salvataggio
atomico verifica che la visita non sia cambiata, conserva lo snapshot precedente
e aggiorna solo la prossima visita della versione selezionata, anche nello storico.
I file PDF già esportati non vengono modificati. I dati sono inclusi nel backup.

Le sedi mancanti si recuperano da `conteggioVisits` per quella data, dalle sessioni
storiche/attive e liste salvate con stessa data e identità verificata (CF oppure
nome/cognome/data nascita), e dagli snapshot della stessa visita. Committente e
azienda devono essere compatibili; assenti e fonti discordanti sono esclusi. Una
sede già presente prevale. Nessuna sede è dedotta dalla sede di lavoro, dalla data
sola o dalla rubrica generale del committente. Il recupero è una proiezione di sola
lettura; le fonti e gli eventuali conflitti sono visibili.

Filtri combinabili: committente, azienda, luogo effettivo di visita, nome/CF,
scaduti, oggi–30/60/90 giorni, date da completare, attivi e cessati. Sede/azienda
mancanti sono segnalate senza bloccare una scadenza calcolabile. I cessati restano
esclusi dalle convocazioni. Ogni apertura/aggiornamento rilegge l'archivio locale;
nessun invio di convocazioni o sincronizzazione dei dispositivi è implicito.

Test: `tests/scadenzario.cjs` (logica e integrazione IndexedDB, backup, PDF) e
`tests/scadenzario-browser.cjs` (Chromium/WebKit, desktop/mobile, data sul
certificato identica in byte). La suite `tests/certificato-pdf.cjs` verifica anche
che i certificati senza prossima visita restino identici alla versione precedente.


### Consultazione DVR e protocolli (18 ottobre 2026)

Il riquadro DVR e protocollo appare nella cartella ma è escluso dalla stampa
e dalle acquisizioni html2canvas. I PDF sono locali, senza richieste a Gmail.
L'abbinamento DVR usa datore e sede di lavoro esatti; il protocollo richiede
anche la mansione esatta e la conferma di validazione del medico. Le versioni
precedenti rimangono consultabili. Nessun accertamento, periodicità o dato
clinico viene compilato o modificato da questo modulo. Non si usano
committente o sede di visita al posto di datore e sede di lavoro.

Il database indipendente `LUMEN_DVR_LOCALE_V1` è isolato in PROVA FANTASMA.
Il pulsante BACKUP DOCUMENTI E COLLEGAMENTI esporta PDF e abbinamenti;
l'importazione ne controlla SHA-256 e struttura prima di una transazione
atomica, integrando i documenti senza cancellare quelli presenti. Questo
archivio non è incluso nel backup ordinario delle cartelle: va esportato
separatamente, anche per trasferirlo fra Mac e iPhone. Nessun trasferimento
è automatico. L'aggancio operativo iniziale è di consultazione: snapshot
del protocollo per visita, validità temporale e confronto accertamenti
richiedono una successiva integrazione clinica.

### Compilazione da protocollo validato (18 ottobre 2026)

Il riquadro DVR permette di registrare una configurazione aziendale validata
acquisendo esclusivamente le caselle del protocollo e le due periodicità,
compresi i rispettivi campi ALTRO. La registrazione richiede datore, sede di
lavoro, mansione, riferimento/revisione, decorrenza e conferma del medico.
Non registra anagrafica o risultati clinici. Le configurazioni non vengono
ricavate automaticamente dai modelli generici o dal testo dei PDF.

Le nuove cartelle vuote ricevono la versione con decorrenza più recente non
successiva alla visita, solo con abbinamento esatto. Le cartelle caricate con
campi protocollo o periodicità già presenti, anche vuoti, sono preservate.
Una copia della configurazione applicata viene conservata nel campo nascosto
`lumen_protocollo_snapshot`, incluso nei normali salvataggi e nello storico.
Aggiornamenti dell'archivio non sostituiscono il protocollo di una visita.
Accertamenti e periodicità restano sempre modificabili dal medico: riapertura
e aggiornamento del riquadro mantengono le correzioni manuali. La versione di
origine resta nei metadati, mentre i campi clinici conservano il dato effettivo.
Le variazioni di azienda/sede/mansione dopo l'applicazione richiedono verifica;
non si sostituiscono automaticamente i valori precedentemente compilati.

Il registro `beltrami_protocolli_validati_v1` è incluso nel backup ordinario ed
è isolato in PROVA FANTASMA. Riferimenti, registrazione e stato sono esclusi da
stampa e PDF; restano stampabili solo i normali campi sanitari della cartella.
Test: `tests/protocolli-auto-dom.cjs` e `tests/protocolli-auto-browser.cjs`.
