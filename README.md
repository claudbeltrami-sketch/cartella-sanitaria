# cartella-sanitaria

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

Verifiche: `node tests/spirometria-percentuali.cjs` e
`node tests/print-exams.cjs` con Playwright Chromium/WebKit. Dati sintetici:
calcolo, percentuali precedenti/manuali, passaggio tra cartelle,
serializzazione, unità, date, valori invalidi, ciclo di stampa e PDF al 125%.
