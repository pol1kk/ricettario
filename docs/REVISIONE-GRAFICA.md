# Revisione grafica: come farla senza rompere l'app

Questo documento è per chi farà la revisione grafica dell'app. Leggilo insieme a `CLAUDE.md`,
`docs/ARCHITETTURA.md` e `docs/PROCEDURE.md` prima di cambiare qualsiasi cosa.

## Cosa vuole Paul

Finora l'app è stata costruita per funzionare: grafica, posizione dei tasti, impaginazione e passaggi tra le
schermate sono provvisori. Paul vuole rivedere tutto perché l'app sia **piacevole e originale**:

- qualche transizione carina, naturale, non invadente;
- elementi grafici propri, non un'app che sembra uguale a mille altre;
- **uno stile riconoscibile per gli ingredienti**, al posto delle emoji provvisorie;
- il **Diario molto più curato**: è la schermata che si apre per prima;
- un aspetto che non sembri generato in serie.

Non ha ancora idee precise: le dirà lui. **Chiedigliele all'inizio** e non partire da supposizioni.
Le sue indicazioni aggiornate sono nel documento di progetto `claude/app-ricette.md`.

## La regola che protegge il lavoro fatto

**La revisione cambia come l'app appare e come ci si muove, non cosa fa.**

| Si può cambiare | Non si tocca |
|---|---|
| `src/styles.css`: colori, caratteri, forme, spazi, animazioni | `src/lib/`: calcoli, lettura e scrittura dei dati, coda offline |
| La struttura visiva dentro `src/screens/`: ordine degli elementi, raggruppamenti, posizione dei comandi | `supabase/migrations/`: nessuna migrazione serve per la grafica |
| Componenti nuovi di sola presentazione (un'illustrazione, un grafico, un'icona) | I testi dei comandi scelti da Paul (elenco nel documento di progetto, punto 7) |
| Le transizioni tra schermate (`src/lib/rotta.ts` usa le View Transitions) | Cosa succede quando si preme un comando |

Se per ottenere un effetto grafico ti sembra di dover cambiare un calcolo, una tabella o il momento in cui
qualcosa viene salvato, fermati: non è più revisione grafica, e va chiesto a Paul.

## Procedura

Segui i passi nell'ordine. Non saltare la scelta dello stile per "portarti avanti".

1. **Fotografa il punto di partenza.** `npm run build && npm run prova`: devono passare. Le schermate in
   `prove/schermate/` sono il "prima": tienile da parte per il confronto.
2. **Raccogli le idee di Paul.** Chiedigli cosa gli piace e cosa no dell'app com'è, e se ha esempi di app o
   immagini che gli piacciono. Poche domande, concrete.
3. **Proponi due o tre direzioni di stile, su una schermata vera.** Usa il Diario del giorno, con dati
   realistici. Ogni direzione deve essere davvero diversa dalle altre (colori, caratteri, forme, come sono
   disegnati gli ingredienti, come si muove). Mostragliele come immagini o come pagina di anteprima,
   **senza toccare l'app pubblicata**. Usa le skill di design disponibili nella sessione.
4. **Aspetta la sua scelta.** Può mescolare elementi di direzioni diverse. Non procedere senza.
5. **Scrivi lo stile scelto come regole.** Variabili in `:root` di `src/styles.css` (colori, caratteri, raggi,
   spazi, durate delle animazioni) e un documento `docs/STILE.md` con le regole: com'è un pulsante principale,
   una riga di elenco, una scheda, un titolo, un'icona di ingrediente, una transizione. Fai approvare a Paul
   un secondo giro su due schermate (Diario e una scheda ricetta) prima di estenderlo.
6. **Applica una sezione alla volta**, in questo ordine: Diario, Ricette (elenco, scheda, modalità cucina),
   Menù, Dispensa e lista, schermate secondarie (obiettivi, impostazioni, accesso). Per ogni sezione:
   - cambia stile e struttura visiva;
   - `npm run build && npm run prova`;
   - guarda le schermate nuove accanto alle vecchie, in chiaro e in scuro;
   - pubblica e fai provare a Paul sul telefono **prima** di passare alla sezione successiva.
7. **Alla fine** aggiorna `CLAUDE.md` (sezione sull'aspetto), `docs/STILE.md` e il documento di progetto. Se
   Paul lo chiede, raccogli le regole di stile in una skill, così chi continua mantiene lo stesso aspetto.

## Le prove durante la revisione

Le prove in `prove/` usano l'app come una persona: premono comandi e leggono testi. Molti controlli cercano
gli elementi per **nome di classe** (`.riga-voce`, `.scorta`, `.proposta-pasto`…) o per **testo del comando**.

- Se rinomini una classe o sposti un elemento e una prova fallisce, **aggiorna il modo in cui la prova trova
  l'elemento, mai quello che verifica**. Una prova che controllava "dopo L'ho mangiato la voce è nel diario"
  deve continuare a controllarlo.
- Non cancellare una prova perché "ora la schermata è diversa". Se un comportamento provato sparisce, è un errore.
- Mantieni `document.documentElement.scrollWidth === 390`: nessuna schermata deve scorrere di lato.
- Aggiungi schermate (`foto()`) per ogni schermata ridisegnata.

## Cose che devono restare vere

Controllale a mano su ogni sezione ridisegnata; sono le cose che una revisione grafica rompe più spesso.

- Tutto si legge e si usa a 390 px di larghezza, con una mano; i comandi principali sono raggiungibili col pollice.
- Bersagli da toccare di almeno 44 px.
- Tema scuro automatico: ogni colore passa da una variabile, mai un colore fisso nel componente.
- Contrasto sufficiente per testo e comandi, in chiaro e in scuro.
- Funziona con la tastiera e con lo screen reader: etichette vere, `aria-pressed`, `aria-expanded`, ordine di lettura sensato.
- `prefers-reduced-motion`: con le animazioni ridotte l'app resta usabile e niente lampeggia o scorre.
- I macronutrienti hanno sempre lo stesso colore: proteine blu, carboidrati gialli, grassi verdi (si possono
  ritoccare le tonalità, non scambiarli).
- La **modalità spesa** resta a righe grandi e senza distrazioni; la **modalità cucina** resta leggibile da lontano.
- Senza rete l'app si apre e la lista della spesa si può spuntare.
- L'app resta leggera: niente librerie di animazione o di componenti senza un motivo forte; caratteri e immagini
  inclusi nell'app (deve funzionare offline), illustrazioni in SVG.
- Gli ingredienti: oggi `ingredienti.icona` contiene un'emoji. Uno stile proprio per gli ingredienti va pensato
  per **tutti** gli ingredienti, anche quelli che verranno aggiunti in futuro con nuovi reel: serve un modo di
  disegnarli che non richieda un'illustrazione fatta a mano per ciascuno (per esempio forme e colori per
  categoria, con un piccolo insieme di disegni), e un aspetto dignitoso per quelli senza disegno.

## Errori da evitare

- Rifare tutta la grafica in un colpo solo e pubblicarla: se qualcosa non piace o si rompe, non si capisce cosa.
- Partire dal codice invece che dalla scelta dello stile con Paul.
- Cambiare i testi dei comandi o l'ordine delle sezioni della barra (Diario, Menù, Dispensa, Ricette) senza chiederglielo.
- Aggiungere decorazioni che non dicono niente: ogni elemento grafico deve aiutare a capire o a orientarsi.
- Riusare un nome di classe già esistente con un altro significato (è già successo con `.quanto`).
