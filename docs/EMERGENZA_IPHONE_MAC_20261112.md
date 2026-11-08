# LUMEN — Piano di emergenza iPhone → Mac
**Preparazione per la seduta di giovedì 12 novembre 2026 — Sermolab, Sermoneta**

## Obiettivo
Se il Mac si spegne, si blocca, non dispone di rete o diventa inutilizzabile, il medico prosegue le visite su Chrome iPhone: cartella, esami, giudizio, firma con dito tramite **ACQUISISCI FIRMA** senza QR. Il programma deve salvare ogni cartella localmente. Quando il Mac torna disponibile, si trasferisce il file di emergenza e lo si **integra**, non si usa **RIPRISTINA BACKUP**.

## Stato della versione sperimentale
Il nuovo strumento **emergenza-iphone-mac.html** è separato dall'interfaccia ordinaria. La funzione di firma diretta è già nel codice principale e NON viene modificata. **emergenza-merge.js** calcola in sola memoria un piano di inserimento e segnala i conflitti.

Esportazione sperimentale: data della seduta; cartelle/versioni della stessa data; firma incorporata nelle cartelle; allegati incorporati, associati allo stesso lavoratore e data; copia informativa dei dati di sessione. Il Mac riceve una **anteprima**: nuove visite, duplicati, lavoratori e conflitti. Se esistono conflitti, l'importazione è impedita. L'importazione richiede conferma esplicita di aver creato un **backup Mac verificato**; esegue il reinserimento dei soli record necessari e verifica la rilettura. L'archivio locale del Mac NON viene azzerato.

**Limiti ancora da collaudare / completare:** i consensi cartacei conservati nel database separato, la lista originale della sessione e gli stati operativi/assenti non vengono al momento reinseriti nel normale pannello della sessione del Mac: i dati amministrativi di sessione sono conservati in un registro separato di recupero, senza sovrascrivere la sessione attiva. PDF esterni non incorporati bloccano l'esportazione; file molto grandi devono essere verificati sui dispositivi. Non considerare questa versione sufficiente per una seduta reale finché questi punti non sono risolti. Le operazioni su due database distinti non costituiscono una transazione unica: serve sempre il backup Mac precedente.

## Procedura di collaudo controllato (solo dati inventati)
1. Con Mac e iPhone collegati, **non** modificare la versione di produzione; preparare backup Mac e iPhone aggiornati e verificati.
2. Aprire LUMEN in modalità **PROVA FANTASMA** sullo stesso browser Chrome iPhone da usare nelle sedute.
3. Compilare la cartella fittizia, premere **ACQUISISCI FIRMA**, disegnare con il dito e confermare. Riaprire la cartella e verificare la firma. Non premere **INVIA A IPHONE** e non scansionare QR.
4. Simulare Mac non disponibile, poi togliere Internet all'iPhone. Ripetere salvataggio e apertura della visita; verificare che programma e archivio funzionino offline.
5. Aprire **emergenza-iphone-mac.html?prova=fantasma** sullo stesso browser/origine già predisposti per l'uso offline, selezionare la data e preparare il file. Usare **SALVA SU FILE**; aprire File e verificare nome e dimensione. Non presumere che una condivisione riuscita equivalga a un salvataggio.
6. Sul Mac, in **PROVA FANTASMA**, effettuare un backup di prova, aprire la pagina sperimentale, scegliere il file ricevuto e leggere l'anteprima. Non accettare file di provenienza ignota.
7. Confermare backup verificato e importare; riaprire cartella, controllare anagrafica, anamnesi, risultati, giudizio, data, firma e allegati. Verificare lo storico Mac.
8. Importare **una seconda volta lo stesso file**: attese **zero nuove visite** e nessuna duplicazione.
9. Ripetere con un'ulteriore visita fittizia nella stessa data ma con firma/dati diversi: il conflitto deve impedire modifiche.
10. Simulare disconnessione AirDrop: conservare il file in **File** iPhone, trasferirlo più tardi con metodo locale protetto; non dipendere da AirDrop o dall'invio automatico.
11. Solo dopo esito positivo e ulteriore revisione, valutare l'abilitazione all'uso operativo. Mai utilizzare dati sanitari reali nelle prove.

## Blocchi necessari prima della seduta reale
- Importazione di consensi separati, allegati esterni e lista originale oppure messaggio esplicito che indica cosa manca e una procedura di recupero verificata.
- Riconciliazione dei metadati di sessione (visitati, assenti, sede, committente) e dei conteggi.
- Verifica su Chrome iPhone effettivo e Mac, con rete disattivata, riavvio browser e conservazione a lungo termine.
- Integrità e controllo dei file, backup verificato, errori e conflitti chiari, nessuna perdita o sovrascrittura di cartelle già presenti.
- Nessuna modifica del programma principale in produzione prima di prova e autorizzazione.

## Test automatici di logica
`node tests/emergenza-merge.cjs`: aggiunta di una nuova data conservando la precedente; firma; idempotenza; conflitto stessa data/dati diversi; contabilità per data; blocco su storico troppo lungo, file incoerente e duplicati. Questi controlli NON sostituiscono i test sui browser reali e non certificano tutte le integrazioni.
