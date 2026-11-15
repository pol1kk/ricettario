import { useState, type FormEvent } from 'react';
import type { Casa, Ingrediente } from '../lib/dati';
import { leggiNumero } from '../lib/diario';
import {
  POSIZIONI,
  cercaProdotto,
  cercaSuOpenFoodFacts,
  leggiData,
  mascheraData,
  mettiInDispensa,
  posizioneAbituale,
  salvaProdotto,
  type Posizione,
  type Prodotto,
} from '../lib/dispensa';
import Scanner from './Scanner';

const UNITA = { g: 'g', ml: 'ml', unita: 'pezzi' } as const;
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Una confezione da mettere in dispensa: quantità, scadenza e posto.
 * La scansione è facoltativa: serve a compilare la quantità dal formato del prodotto.
 */
export default function ModuloConfezione({
  casa,
  ingrediente,
  prodottoIniziale,
  quantitaProposta,
  voceLista,
  intestazione,
  fatto,
  salta,
  annulla,
}: {
  casa: Casa;
  ingrediente: Ingrediente;
  prodottoIniziale?: Prodotto | null;
  quantitaProposta?: number | null;
  voceLista?: string;
  /** riga piccola sopra il nome, per esempio "2 di 6" */
  intestazione?: string;
  fatto: () => void;
  /** nella fine spesa: non metterlo in dispensa e passare al prossimo */
  salta?: () => void;
  annulla: () => void;
}) {
  const formato = (p: Prodotto | null | undefined) =>
    p && p.formato_quantita && p.formato_unita === ingrediente.unita_base ? p.formato_quantita : null;
  const iniziale = formato(prodottoIniziale) ?? quantitaProposta ?? (ingrediente.unita_base === 'unita' ? 1 : null);

  const [prodotto, setProdotto] = useState<Prodotto | null>(prodottoIniziale ?? null);
  const [quantita, setQuantita] = useState(iniziale === null ? '' : String(iniziale).replace('.', ','));
  const [scadenza, setScadenza] = useState('');
  const [posizione, setPosizione] = useState<Posizione>(prodottoIniziale?.posizione_predefinita ?? posizioneAbituale(ingrediente));
  const [confezioni, setConfezioni] = useState(1);
  const [scanner, setScanner] = useState(false);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  const q = leggiNumero(quantita);
  const data = leggiData(scadenza);
  const aStato = ingrediente.base;
  const valido = (aStato || (q !== null && q > 0)) && data !== 'errore';

  async function codiceLetto(codice: string) {
    setScanner(false);
    setAttesa(true);
    setErrore(null);
    setAvviso(null);
    try {
      let p = await cercaProdotto(casa.id, codice);
      let messaggio: string | null = null;
      if (!p) {
        // prodotto mai visto: lo si collega a questo ingrediente senza fare domande
        const trovato = await cercaSuOpenFoodFacts(codice).catch(() => null);
        p = await salvaProdotto(
          casa.id,
          codice,
          ingrediente.id,
          trovato && trovato.nome
            ? trovato
            : { nome: maiuscola(ingrediente.nome), marca: null, formato_quantita: null, formato_unita: null, kcal_100: null, proteine_100: null, carboidrati_100: null, grassi_100: null },
          posizione,
        );
        if (!trovato) messaggio = 'Non trovo questo codice nell’archivio dei prodotti: l’ho collegato lo stesso a questo ingrediente.';
      }
      if (p.ingrediente_id !== ingrediente.id) {
        // codice già collegato a un altro ingrediente: probabilmente è stato inquadrato un altro prodotto
        setAvviso('Questo codice è collegato a un altro ingrediente: controlla di aver inquadrato il prodotto giusto. Per questa voce non lo uso.');
      } else {
        setProdotto(p);
        setPosizione(p.posizione_predefinita);
        const f = formato(p);
        if (f) setQuantita(String(f).replace('.', ','));
        else if (!aStato && !messaggio) messaggio = 'Il prodotto non indica il formato: la quantità scrivila tu.';
        setAvviso(messaggio);
      }
    } catch (e) {
      setErrore(`Non sono riuscito a leggere il prodotto: ${(e as Error).message}`);
    }
    setAttesa(false);
  }

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setAttesa(true);
    setErrore(null);
    try {
      await mettiInDispensa(casa.id, {
        ingrediente_id: ingrediente.id,
        prodotto_id: prodotto?.id ?? null,
        quantita: aStato ? null : q,
        scadenza: data as string | null,
        posizione,
        confezioni,
        voce_lista: voceLista ?? null,
      });
      fatto();
    } catch (err) {
      setErrore(`Non salvato: ${(err as Error).message}. Controlla la connessione e riprova.`);
      setAttesa(false);
    }
  }

  if (scanner) return <Scanner trovato={codiceLetto} chiudi={() => setScanner(false)} />;

  return (
    <main className="confezione">
      <div className="barra">
        <button className="indietro secondario" onClick={annulla}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Indietro
        </button>
      </div>
      <header className="ricetta-testa">
        {intestazione && <p className="passo-spesa">{intestazione}</p>}
        <h1>
          {ingrediente.icona && <span aria-hidden="true">{ingrediente.icona} </span>}
          {maiuscola(ingrediente.nome)}
        </h1>
        {prodotto && (
          <p className="origine">
            {prodotto.nome}
            {prodotto.marca && <>, {prodotto.marca}</>}
          </p>
        )}
      </header>

      <form className="modulo" onSubmit={salva}>
        {!prodotto && (
          <button type="button" className="contorno scansiona" disabled={attesa} onClick={() => setScanner(true)}>
            <IconaCodice />
            Scansiona la confezione
          </button>
        )}
        {avviso && <p className="stato-rete">{avviso}</p>}

        {!aStato && (
          <>
            <label htmlFor="conf-quantita">Quantità di una confezione</label>
            <span className="campo-unita largo">
              <input id="conf-quantita" inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
              <span>{UNITA[ingrediente.unita_base]}</span>
            </span>
          </>
        )}

        <label htmlFor="conf-scadenza">Scadenza</label>
        <input
          id="conf-scadenza"
          inputMode="numeric"
          placeholder="gg/mm/aaaa"
          autoComplete="off"
          aria-invalid={data === 'errore'}
          value={scadenza}
          onChange={(e) => setScadenza(mascheraData(e.target.value))}
        />
        <p className="nota">
          {data === 'errore' ? 'Scrivi giorno, mese e anno, per esempio 05/03/2027.' : 'Lascia vuoto se non scade. Puoi scrivere anche solo giorno e mese.'}
        </p>

        <fieldset className="posizioni">
          <legend>Dove lo metti</legend>
          <div className="viste tre" role="group">
            {POSIZIONI.map((p) => (
              <button key={p.valore} type="button" aria-pressed={posizione === p.valore} onClick={() => setPosizione(p.valore)}>
                {p.nome}
              </button>
            ))}
          </div>
        </fieldset>

        {!aStato && (
          <div className="riga-porzioni">
            <span>Confezioni uguali</span>
            <div className="porzioni" role="group" aria-label="Confezioni uguali">
              <button type="button" aria-label="Una confezione in meno" disabled={confezioni <= 1} onClick={() => setConfezioni(confezioni - 1)}>
                −
              </button>
              <output aria-live="polite">{confezioni}</output>
              <button type="button" aria-label="Una confezione in più" disabled={confezioni >= 20} onClick={() => setConfezioni(confezioni + 1)}>
                +
              </button>
            </div>
          </div>
        )}

        {errore && (
          <p role="alert" className="errore">
            {errore}
          </p>
        )}
        <button type="submit" disabled={attesa || !valido}>
          {attesa ? 'Un momento…' : 'Metti in dispensa'}
        </button>
        {salta && (
          <button type="button" className="secondario" disabled={attesa} onClick={salta}>
            Salta, non va in dispensa
          </button>
        )}
      </form>
    </main>
  );
}

export function IconaCodice() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M3 7V4h3M16 4h3v3M19 15v3h-3M6 18H3v-3M7 7v8M10 7v8M12.5 7v8M15 7v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
