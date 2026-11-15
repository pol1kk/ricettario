# Architettura

## In breve

- **App**: una sola pagina React, pubblicata come file statici su GitHub Pages (`/ricettario/`) a ogni push su `main`.
  Installabile come PWA; il service worker tiene in copia i file dell'app.
- **Dati**: Supabase (Postgres + Auth + Storage). L'app parla direttamente con il database tramite
  `@supabase/supabase-js`; quello che un utente può leggere o scrivere lo decidono le regole RLS nel database.
- **Niente server nostro**. L'unica chiamata esterna oltre a Supabase è Open Food Facts, dal telefono, per i codici a barre.
- **Portabilità**: per spostare tutto altrove (per esempio su un NAS) bastano le migrazioni, un backup e due
  righe in `src/lib/supabase.ts` (vedi README).

## Cartelle

```
src/
  App.tsx            sessione, caricamento dei dati comuni, scelta della schermata
  styles.css         tutto lo stile
  lib/               dati e logica, senza interfaccia
  screens/           schermate e loro pezzi
supabase/migrations/ struttura del database, in ordine
prove/               prove nel browser con backend finto
scripts/             script usati per importare gruppi di ricette (esempio da cui partire)
.github/workflows/   deploy.yml (pubblicazione), backup.yml (copia di database e foto)
docs/                questi documenti
```

## Navigazione (`src/lib/rotta.ts`)

L'indirizzo è nel frammento (`#/…`). `usaRotta()` restituisce la rotta corrente; il passaggio tra schermate usa le View Transitions.

| Indirizzo | Vista | Schermata | Tipo |
|---|---|---|---|
| `#/` (e qualsiasi altro) | `diario` | `Diario.tsx` | principale, è quella di apertura |
| `#/menu` | `menu` | `Menu.tsx` | principale |
| `#/dispensa` | `dispensa` | `Dispensa.tsx` | principale |
| `#/lista` | `lista` | `Lista.tsx` | principale (scheda "Da comprare" della sezione Dispensa) |
| `#/ricette` | `elenco` | `Elenco.tsx` | principale |
| `#/ricetta/<id>` | `ricetta` | `Ricetta.tsx` | sopra, con "indietro" |
| `#/cucina/<id>` | `cucina` | `Cucina.tsx` | sopra |
| `#/obiettivi` | `obiettivi` | `Obiettivi.tsx` | sopra |
| `#/consiglio` | `consiglio` | `Consiglio.tsx` ("Cosa mangio?") | sopra |
| `#/nuova-ricetta` | `nuova-ricetta` | `NuovaRicetta.tsx` (ricetta scritta a mano o incollata) | sopra |
| `#/preferenze` | `preferenze` | `Preferenze.tsx` (preferenze del menù, questionario la prima volta) | sopra |
| `#/impostazioni`, `#/tag` | | `Impostazioni.tsx`, `GestioneTag.tsx` | sopra |

- Le viste principali (`PRINCIPALI`) hanno la barra in basso (`Barra.tsx`): Diario, Menù, Dispensa, Ricette.
  Tra loro si passa con `vaiAScheda()` (non allunga la cronologia); alle altre si va con `vai()`.
- La voce "Dispensa" della barra copre due viste, `dispensa` e `lista`, e riapre l'ultima usata
  (copia locale `scheda-dispensa`). In cima a entrambe c'è `SchedeDispensa.tsx` ("In casa" / "Da comprare").
- Le schermate di secondo livello dentro una sezione (scegliere cosa aggiungere, mettere via un prodotto, lo
  scanner) **non sono rotte**: sono stati locali della schermata che le apre, che al loro posto restituisce un
  altro componente (`if (aggiunta) return <AggiungiAlDiario … />`).

## Dati nell'app

- **Dati comuni** (`src/lib/dati.ts`, tipo `Dati`): casa, tag, ricette con ingredienti e tag, catalogo degli
  ingredienti (con valori per 100 g e peso di un pezzo), reparti. Li carica `App.tsx` una volta con `caricaDati()`,
  li salva in copia locale e li passa alle schermate. Dopo una modifica che li tocca si chiama `ricarica()`.
- **Dati di una sezione**: ogni sezione legge i propri quando si apre e li tiene nel proprio stato.

| Modulo | Cosa fa |
|---|---|
| `lib/piano.ts` | menù: `PASTI` (i cinque pasti), lettura e modifica di `piano_pasti`, `segnaCucinataOggi` |
| `lib/lista.ts` | lista della spesa **con coda offline** (unico punto che scrive senza rete) |
| `lib/diario.ts` | diario e obiettivi; calcoli sui valori (`valoriRicetta`, `valoriAlimento`, `pesoPorzione`, `somma`, `moltiplica`) |
| `lib/dispensa.ts` | confezioni, prodotti e codici a barre, Open Food Facts, date e scadenze, scarico (`scalaDispensa`, `riassumiDispensa`) |
| `lib/preferenze.ts` | preferenze del menù della casa e di ciascuno, obiettivi di tutta la casa (`leggiObiettiviCasa`) |
| `lib/proposta.ts` | "Proponi settimana": **solo calcolo** (`proponiSettimana`, `alternative`, `alternativaPerMe`, `lontanoDagliObiettivi`) |
| `lib/testoRicetta.ts` | legge il testo incollato di una ricetta: **solo calcolo** (`leggiTestoRicetta`, `trovaNelCatalogo`, `adattaQuantita`) |
| `lib/consiglio.ts` | consiglio di un pasto: **solo calcolo**, senza rete né interfaccia (`consiglia`, `obiettivoDelPasto`) |
| `lib/date.ts` | giorni come stringhe `aaaa-mm-gg`, settimana dal lunedì |
| `lib/foto.ts`, `lib/schermo.ts`, `lib/password.ts` | foto di copertina, schermo acceso, promemoria password |

- **Schema di una schermata con dati propri** (copialo: `Menu.tsx`, `Diario.tsx`, `Dispensa.tsx` sono uguali):
  stato iniziale dalla copia locale (`leggiCache`), funzione `carica()` che legge dal database e aggiorna stato
  e copia, funzione `fai(azione)` che esegue una scrittura, ricarica e mostra l'errore se fallisce.
- **Senza rete**: tutto si può leggere dall'ultima copia; si può scrivere solo nella lista della spesa
  (spunte, voci nuove, cambio reparto), tramite la coda di `lib/lista.ts`. Le altre scritture mostrano un errore.
- Copie locali (`localStorage`, prefisso `ricettario.`): `dati`, `piano.<lunedì>`, `lista`, `lista.base`,
  `diario.<utente>.<lunedì>`, `obiettivi.<utente>`, `dispensa`, `scheda-dispensa`.

## Database

Schema `public`; funzioni di servizio in `private`. I file in `supabase/migrations/` sono la fonte di verità.

**Della casa** (RLS: `casa_id in (select private.mie_case())`)

| Tabella | Contenuto |
|---|---|
| `case`, `membri`, `inviti` | la casa, chi ne fa parte (`membri.nome` è il nome mostrato agli altri, si cambia con `imposta_nome`), inviti per email |
| `reparti` | reparti del supermercato, con `ordine` |
| `ingredienti` | catalogo: `nome` (minuscolo, unico), `unita_base` (`g`, `ml`, `unita`), `tracciamento` (`quantita` o `stato`), `icona` (emoji), valori per 100 g/ml, `grammi_per_unita`, `gruppo` (per i limiti), `porzione_spuntino` e `ruolo_spuntino` (per colazioni e merende) |
| `alias_ingredienti` | altri nomi dello stesso ingrediente |
| `ricette` | titolo, reel, porzioni, tempi, `passaggi` (jsonb `[{testo, gruppo?}]`), valori **per porzione**, `valori_fonte` (`dichiarati` o `stimati`), `da_verificare` |
| `ricetta_ingredienti` | quantità nell'unità base dell'ingrediente; quantità nulla = q.b.; `gruppo`, `facoltativo` |
| `tag`, `ricetta_tag` | tag a gruppi; quello con `automatico = true` ("veloce") lo calcola l'app dal tempo |
| `piano_pasti` | menù: giorno, pasto, ricetta **o** nota, porzioni, `cucinata_il`, `per_utente` (nullo = per tutta la casa, altrimenti voce personale), `proposta`, `alimenti` |
| `lista_spesa`, `voci_ricordate` | lista (origine `menu`, `manuale`, `scorta`) e reparto ricordato per le voci scritte a mano |
| `preferenze_casa` | preferenze del menù della casa: una riga, campo `dati` jsonb (tipo `PreferenzeCasa`) |
| `preferenze_persona` | preferenze di ciascuno (tipo `PreferenzePersona`): **le leggono tutti i membri, le scrive solo l'interessato** |
| `prodotti` | un codice a barre collegato a un ingrediente, con formato e valori |
| `dispensa` | **una riga per confezione**; `quantita` oppure `stato`; `scadenza`; `posizione`; `esaurita_il` quando finisce |
| `movimenti_dispensa` | storico: acquisto, uso, ricetta, buttato, correzione |

**Personali** (RLS: `utente_id = auth.uid()`): `diario` (cosa ha mangiato la persona; nome e valori sono una
fotografia del momento), `obiettivi` (una riga per persona).

**Funzioni chiamate dall'app o da chi importa**

| Funzione | Uso |
|---|---|
| `importa_ricetta(casa, json)` | crea o aggiorna una ricetta con ingredienti e tag, tutto insieme |
| `correggi_ricetta(ricetta, json)` | correzioni dalla scheda |
| `stima_valori_ricetta(ricetta)` | valori per porzione stimati dagli ingredienti |
| `unisci_tag`, `invita_in_casa`, `persone_casa` | gestione tag e persone |
| `genera_lista_spesa(casa, dal, al)` | rifà le voci di origine `menu` dalla settimana, lascia le manuali; compra solo ciò che manca rispetto alla dispensa (lo scaduto non conta) |
| `metti_in_dispensa(casa, json)` | confezioni + movimento + toglie la voce dalla lista |
| `chiudi_confezione(dispensa, motivo)` | confezione finita o buttata |
| `obiettivi_casa(casa)` | obiettivi di tutti i membri, solo per calcolare il menù (la tabella `obiettivi` resta leggibile solo dal proprietario) |
| `scala_dispensa(casa, json)` | toglie le quantità usate dalle confezioni che scadono prima, con i movimenti |

**Due idee da tenere a mente**

- *Ingredienti a quantità o a stato.* Quelli con `tracciamento = 'stato'` (sale, olio, spezie, salse) non si
  contano: in dispensa hanno uno stato ("c'è", "sta finendo"), non entrano da soli nella lista generata dal menù,
  nell'app compaiono come `base: true`.
- *Una sola unità per ingrediente.* Tutte le quantità di un ingrediente (ricette, lista, dispensa) sono nella
  sua `unita_base`: è questo che permette di sommarle e confrontarle.

## Menù condiviso e voci personali

- Il menù è uno solo per la casa. Una voce con `per_utente` è di una sola persona: resta leggibile da tutti
  (gli ingredienti vanno nella lista comune) ma `Menu.tsx` la mostra agli altri solo con l'interruttore
  "Mostra anche le voci personali degli altri".
- `vociPerMe()` in `lib/piano.ts` è la regola unica su cosa riguarda una persona: le sue voci e quelle comuni;
  se in un pasto ha una voce sua, quelle comuni di quel pasto non la riguardano più. La usa il Diario per le proposte.
- Stesso piatto, porzioni diverse: nel Diario la proposta di una voce del menù indica la porzione più adatta agli
  obiettivi di chi guarda (`porzioneConsigliata()` in `lib/consiglio.ts`), ed è quella che "L'ho mangiato" registra.

## Nuova ricetta dall'app

- `NuovaRicetta.tsx` salva con la stessa funzione usata per i reel, `importa_ricetta` (senza `reel_id`, quindi crea sempre
  una ricetta nuova), poi scrive i valori: quelli digitati (`dichiarati`) oppure `stima_valori_ricetta` (`stimati`).
- "Incolla il testo" passa da `leggiTestoRicetta()`: riconosce titolo, porzioni, ingredienti e passaggi, converte le misure
  (kg, litri, cucchiai, tazze) e porta ogni quantità nell'unità dell'ingrediente del catalogo. Non salva niente da solo:
  riempie il modulo. Le righe con quantità stimata, o con l'ingrediente non riconosciuto, sono segnate e vanno controllate.
- Un ingrediente che manca si crea al momento con `ScegliIngrediente.tsx`.
- `ricette.reel_url` contiene anche il link di una fonte che non è un reel: la scheda mostra "Apri la fonte".

## Proponi settimana

- `Menu.tsx` carica il `Contesto` (ricette, catalogo, dispensa, preferenze della casa, e per ogni persona preferenze e
  obiettivi) e chiama `proponiSettimana()`, che restituisce le voci da inserire; non tocca quelle esistenti e parte da oggi.
- Passo 1, pasti comuni (pranzo e cena): solo ricette con tag primo, secondo o piatto unico. Un tag "da evitare" o un
  limite raggiunto di **una** persona esclude il piatto per tutti. Le porzioni della voce sono la somma di quelle di ognuno.
- Passo 2, colazione e merende personali per chi ha obiettivi: ricette con tag colazione o snack, oppure alimenti singoli
  o in coppia. Gli alimenti proponibili hanno `ingredienti.porzione_spuntino` e `ruolo_spuntino`; le coppie ammesse sono
  l'elenco `COPPIE`. Una voce di alimenti ha `piano_pasti.alimenti` (jsonb) e il nome leggibile in `nota`.
- Passo 3: niente di automatico. `lontanoDagliObiettivi()` fa comparire nel menù "Proponimi un'alternativa solo per me".
- **Limiti alle porzioni, da non allargare**: una ricetta da 0,5 a 2 porzioni (`PORZIONI_POSSIBILI`), un alimento da 0,5 a
  1,5 volte la sua porzione tipica (`FATTORI_SPUNTINO`), ogni pasto punta alla sua quota della giornata (`PESO_PASTO`).
- Le voci inserite hanno `proposta = true`: "Un'altra" le sostituisce, "Annulla la proposta" le toglie, "Tieni tutto" le rende normali.
- `sorte()` varia le scelte da una settimana all'altra senza casualità: stessa settimana e stessi dati, stessa proposta.
- Limiti sugli ingredienti: per ingrediente o per `ingredienti.gruppo`; contano tutte le voci della settimana che riguardano la persona.

## Consiglio di un pasto e scarico

- `Consiglio.tsx` legge dispensa, diario degli ultimi tre giorni e obiettivi, poi chiama `consiglia()` a ogni
  cambio delle richieste. Le richieste esplicite (tempo, tag, testo) **escludono**; dispensa, scadenze, obiettivi,
  pasto e varietà danno punti. Ogni consiglio porta i suoi `motivi`, che la schermata mostra così come sono.
  Per cambiare l'ordine dei consigli si tocca solo `lib/consiglio.ts`.
- Gli ingredienti di base (a stato) e quelli facoltativi non contano per dire se una ricetta "si può fare".
- `ScaricoDispensa.tsx` propone di togliere dalla dispensa gli ingredienti usati, con quantità correggibili:
  compare a fine modalità cucina e nel diario dopo "L'ho mangiato" su una voce del menù non ancora cucinata.
  Non mostra nulla se in dispensa non c'è nessuno degli ingredienti.
- In dispensa, dentro la riga di un ingrediente: "Ne ho usato" (scarico senza ricetta) e, per ciò che è scaduto o
  scade entro 3 giorni, "Ricette per usarlo" (ancora `consiglia()`, con `pasto: null`).
- In "Cosa hai mangiato" (`AggiungiAlDiario.tsx`): "Scansiona un prodotto confezionato". I valori vengono, nell'ordine,
  dal prodotto già collegato, dall'ingrediente a cui è collegato, da Open Food Facts; se mancano si passa alla voce a mano.
  Per prodotti e alimenti che sono in dispensa compare la casella "Toglilo dalla dispensa".

## Pubblicazione e copie

- `deploy.yml`: a ogni push su `main` compila e pubblica su GitHub Pages.
- `backup.yml`: lunedì e giovedì (e a richiesta) copia database e foto di copertina in un repository privato.
  I segreti necessari stanno nei secret di GitHub, mai nel codice.
- Storage: bucket privato `copertine`, percorso `<casa>/<ricetta>-<tempo>.jpg`; l'app chiede indirizzi firmati.
