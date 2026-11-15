# Ricettario: istruzioni per chi lavora su questo codice

App personale di Paul: ricette prese dai reel di Instagram, diario alimentare, menù settimanale,
lista della spesa e dispensa. La usano lui e le persone della sua "casa" dal telefono, come app installata (PWA).

Questo file dice come si lavora qui. Leggilo tutto prima di toccare qualcosa, poi leggi nell'ordine:

1. `docs/ARCHITETTURA.md`: com'è fatta l'app (schermate, dati, database, funzionamento senza rete).
2. `docs/PROCEDURE.md`: i passi esatti per modificare, provare, pubblicare, cambiare il database.
3. Il documento di progetto `claude/app-ricette.md` (nel Project di claude.ai, non in questo repository):
   stato attuale, decisioni di Paul, prossimo lavoro da fare. Lì ci sono anche i dati privati (id della casa, persone).

Questo repository è **pubblico**. Non scrivere mai qui dentro: chiavi segrete, password, token, stringhe di
connessione, email o altri dati personali, dati veri del database. La chiave in `src/lib/supabase.ts` è quella
pubblica ed è l'unica ammessa.

## Come lavorare con Paul

- Parla e scrivi in **italiano**: risposte, testi dell'app, nomi nel codice, commenti, messaggi di commit.
- **Prima di scrivere molto codice chiedi conferma.** Per una funzione nuova: descrivi a parole come saranno le
  schermate e cosa succede, aspetta il suo sì, poi scrivi. Per una correzione piccola procedi e basta.
- Una funzione non è finita finché: `npm run build` passa, `npm run prova` passa, è pubblicata, e hai detto a
  Paul cosa provare sul telefono. La prova dal vivo la fa lui: tu non raggiungi né il sito né il database dal browser.
- Di' sempre con precisione cosa hai verificato e cosa no. "Provato con il backend finto" e "provato sul telefono"
  sono cose diverse.
- Se una migrazione del database può chiedergli una conferma (scade in 2 minuti), **avvisalo prima** con un
  messaggio e lanciala mentre è presente.
- Non reimportare una ricetta che Paul ha già corretto dall'app: sovrascriveresti le sue correzioni.

## Regole del codice

- Stack: React 19, TypeScript, Vite, vite-plugin-pwa. Nessun framework CSS, nessuna libreria di componenti,
  nessun gestore di stato: `useState` e poche funzioni. Non aggiungere dipendenze senza un motivo forte
  (l'unica aggiunta finora è `@zxing/browser` per leggere i codici a barre su iPhone, caricata solo quando serve).
- Tutto lo stile è in `src/styles.css`, con le variabili in `:root`. **Prima di scrivere CSS nuovo cerca se la
  classe esiste già** (`.viste`, `.riga-voce`, `.pannello-voce`, `.comandi`, `.contorno`, `.secondario`,
  `.filtro`, `.modulo`, `.campo-unita`, `.quattro-campi`, `.ricette.scelta`…). Attenzione ai nomi generici già
  usati con regole proprie (`.quanto`, `.testi`, `.icona`, `.riga`, `.barra`): riusarli eredita quelle regole.
- Colori dei macronutrienti, ovunque: proteine blu (`--proteine`), carboidrati gialli (`--carboidrati`),
  grassi verdi (`--grassi`), calorie neutre. Tema scuro automatico: usa sempre le variabili, mai colori fissi.
- Testi dell'app: frasi semplici dal punto di vista di chi usa l'app, verbi all'attivo, niente gergo tecnico.
  Un pulsante dice cosa succede ("Metti in dispensa"). Un errore dice cosa è successo e cosa fare.
- Numeri all'italiana: virgola per i decimali, `gg/mm/aaaa` per le date. Le date nel codice sono stringhe
  `aaaa-mm-gg` costruite con le funzioni di `src/lib/date.ts` (mai `toISOString()` per un giorno: sbaglia col fuso).
- Valori nutrizionali sempre nei campi dedicati (`kcal`, `proteine_g`, `carboidrati_g`, `grassi_g`), mai nelle note.
- Ogni schermata deve funzionare a 390 px di larghezza senza scorrimento orizzontale, con la tastiera e con
  uno screen reader (etichette vere, `aria-pressed`, `aria-expanded`), e rispettare `prefers-reduced-motion`.
- Aspetto: sobrio e leggibile, transizioni brevi e naturali. Niente effetti decorativi, niente maiuscoletti,
  niente schede tutte uguali con ombre. Lo stile definitivo e le icone degli ingredienti sono rimandati per
  scelta di Paul: non rifare la grafica di tua iniziativa.

## Regole del database

- Ogni modifica alla struttura passa da un file nuovo in `supabase/migrations/` (numero successivo), applicato
  con lo strumento di migrazione di Supabase **e** salvato nel repository con lo stesso contenuto. Mai modificare
  una migrazione già applicata.
- Dati della casa: ogni tabella ha `casa_id` e una regola RLS `casa_id in (select private.mie_case())`.
  Dati personali (diario, obiettivi): `utente_id = auth.uid()`. Una tabella nuova senza RLS è un errore grave.
- Funzioni: `set search_path = ''`, nomi completi di schema, `revoke … from public, anon` e
  `grant execute … to authenticated`. Niente `security definer` se non è indispensabile.
- Più scritture che devono riuscire insieme si fanno in una funzione SQL (vedi `metti_in_dispensa`), non con
  più chiamate dall'app.
- Prova ogni funzione nuova con un blocco che si annulla da solo (modello in `docs/PROCEDURE.md`).

## Comandi

```
npm install
npm run build     # controllo dei tipi + build in dist/
npm run prova     # prove nel browser con backend finto (serve la build)
npm run prova -- dispensa   # una prova sola
```

Commit in italiano, al presente, che dicono cosa cambia per chi usa l'app. Push su `main` = pubblicazione.
