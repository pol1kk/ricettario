# Procedure

Passi da seguire nell'ordine. Se un passo fallisce, fermati e risolvi quello prima di andare avanti.

## 0. All'inizio di ogni sessione

1. Leggi `CLAUDE.md`, `docs/ARCHITETTURA.md` e il documento di progetto `claude/app-ricette.md`.
2. Se il repository non c'è nello spazio di lavoro, aggiungilo (`pol1kk/ricettario`, accesso in scrittura) e clonalo; poi `npm install`.
3. `git pull`, `npm run build`, `npm run prova`: devono passare **prima** di cambiare qualcosa. Se non passano, il problema viene prima del lavoro richiesto.

Cosa puoi e non puoi raggiungere dalla sessione cloud:

- Sì: il repository (git push), l'API di GitHub con `gh api …`, il database con gli strumenti Supabase (SQL e migrazioni).
- No: il sito pubblicato e il database dal browser o da `curl`. Per questo le schermate si provano con il backend finto.

## 1. Modificare l'app

1. Trova la schermata in `src/screens/` e il modulo in `src/lib/` (tabelle in `docs/ARCHITETTURA.md`).
2. Leggi il file intero prima di cambiarlo, e una schermata simile già fatta da cui copiare la struttura.
3. Scrivi la modifica. Per lo stile, cerca prima le classi esistenti in `src/styles.css`.
4. `npm run build` (controlla anche i tipi).
5. Aggiungi o aggiorna una prova in `prove/` (vedi sotto) e lancia `npm run prova`.
6. Guarda le schermate salvate in `prove/schermate/`: testo che esce dai bordi, elementi sovrapposti, tema scuro.
7. Commit e push su `main`, poi controlla la pubblicazione (punto 4).
8. Aggiorna i documenti (punto 6) e di' a Paul cosa provare sul telefono.

## 2. Le prove (`prove/`)

- `prove/base.cjs` apre l'app compilata in un browser senza interfaccia, con una sessione finta e un finto
  Supabase in memoria (`stato`). Ogni tabella o funzione usata dall'app ha lì la sua risposta finta.
- Ogni file di prova prepara lo `stato`, chiama `entra()`, usa l'app come farebbe una persona e verifica con `assert`.
- `prove/tutte.cjs` le esegue tutte: `npm run build && npm run prova`.

Quando aggiungi una funzione:

- Se l'app chiama una tabella o una funzione SQL nuova, aggiungi la risposta finta in `base.cjs`
  (copia un blocco `rotta('**/rest/v1/…')` simile). Una chiamata senza risposta finta va al server vero e fallisce.
- Aggiungi un file `prove/<nome>.cjs` e il suo nome nell'elenco `PROVE` di `tutte.cjs`.
- Verifica i risultati con `assert`, non a occhio; salva comunque le schermate importanti con `foto()`.
- Le schermate prese a pagina intera mostrano la barra in basso a metà pagina: è normale.
- La fotocamera finta (`crea({ camera: true })`) inquadra sempre il codice `8001234567897`.

## 3. Modificare il database

1. Scrivi il file `supabase/migrations/00NN_nome.sql` (numero successivo all'ultimo).
2. Avvisa Paul con un messaggio che stai per lanciare una migrazione (può comparirgli una conferma che scade in 2 minuti).
3. Applicala con lo strumento di migrazione di Supabase, con lo **stesso identico SQL** del file.
4. Prova le funzioni nuove con un blocco che si annulla da solo. L'eccezione finale annulla tutto: il
   risultato si legge nel messaggio d'errore, e nel database non resta niente.

```sql
do $$
declare u uuid; casa uuid := '<id della casa, dal documento di progetto>'; n int; msg text := '';
begin
  select utente_id into u from public.membri where casa_id = casa and ruolo = 'proprietario' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;            -- da qui valgono i permessi di un utente vero
  -- … chiamate da provare, scrivendo i risultati in msg …
  raise exception 'TEST_OK %', msg;        -- annulla tutto
end $$;
```

5. Se hai aggiunto una tabella: verifica che un altro utente non veda le righe (stessa tecnica, cambiando `sub`).
6. Commit del file di migrazione insieme al codice che la usa.

Attenzione: un valore aggiunto a un tipo `enum` non si può usare nella stessa transazione in cui lo aggiungi.

## 4. Pubblicare e controllare

```
git push
gh api "repos/pol1kk/ricettario/actions/workflows/deploy.yml/runs?per_page=1" --jq '.workflow_runs[0] | "\(.head_sha[0:7]) \(.status) \(.conclusion)"'
```

Ripeti il secondo comando finché dice `completed success` (un paio di minuti). Paul vede la versione nuova
riaprendo l'app; a volte serve chiuderla e riaprirla due volte perché il service worker si aggiorni.

Copia di sicurezza a richiesta: `gh api -X POST repos/pol1kk/ricettario/actions/workflows/backup.yml/dispatches -f ref=main`

## 5. Importare ricette dai reel

È un lavoro sui dati, non sul codice. La procedura completa, con le convenzioni su ingredienti, quantità e
valori nutrizionali, è nel documento di progetto `claude/app-ricette-importare-reel.md`.
`scripts/import_2026-11-14.py` è un esempio di script che genera le chiamate a `importa_ricetta`.

## 6. A fine lavoro

- Aggiorna `docs/ARCHITETTURA.md` se hai aggiunto schermate, moduli, tabelle o funzioni.
- Aggiorna `claude/app-ricette.md`: sezione "Stato", "Prossimo lavoro" e, se Paul ha deciso qualcosa, "Decisioni".
  Riscrivi il documento intero, pulito; non accodare note in fondo.
- Scrivi a Paul: cosa è cambiato, cosa hai verificato e come, cosa deve provare lui, cosa resta da fare.

## Errori già capitati (non ripeterli)

- **Dati non salvati nel repository.** Una migrazione applicata al database ma non salvata in `supabase/migrations/`.
- **Classe CSS con un nome già usato.** `.quanto` aveva già una larghezza fissa: il testo usciva dalla riga e
  la pagina scorreva di lato. Controlla `scrollWidth` nelle prove.
- **Schermata fotografata durante un'animazione.** Sembra vuota: usa `foto()`, che aspetta.
- **Quantità assurde in lista** ("¾ di uovo"): per la spesa si arrotonda per eccesso a pezzi interi (`formattaQuantitaSpesa`).
- **Date spostate di un giorno**: mai `toISOString()` per un giorno di calendario.
- **Login con codice via email**: i progetti Supabase gratuiti non permettono di cambiare i modelli delle email;
  l'accesso è con email e password, il link serve solo per il primo accesso.
- **`gh` con comandi normali** (`gh run list`): nella sessione cloud funziona solo `gh api …`.
