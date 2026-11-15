import { useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Casa, Dati, Ingrediente } from '../lib/dati';
import { leggiNumero } from '../lib/diario';
import { tornaAllElenco, vai } from '../lib/rotta';
import { adattaQuantita, leggiTestoRicetta, trovaNelCatalogo } from '../lib/testoRicetta';
import ScegliIngrediente from './ScegliIngrediente';
import { CampiValori, TESTI_VUOTI } from './ValoriDiario';

const UNITA = { g: 'g', ml: 'ml', unita: 'pezzi' } as const;
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Riga = {
  chiave: number;
  /** com'era scritto nel testo incollato, se viene da lì */
  testo: string | null;
  ingrediente: Ingrediente | null;
  quantita: string;
  daControllare: boolean;
};

let prossimaChiave = 1;

/**
 * Una ricetta scritta a mano o incollata da un'altra fonte. Il testo incollato riempie il modulo;
 * chi lo usa controlla, collega gli ingredienti che non sono stati riconosciuti e salva.
 */
export default function NuovaRicetta({ dati, casa, ricarica }: { dati: Dati; casa: Casa; ricarica: () => Promise<void> }) {
  const [incollato, setIncollato] = useState('');
  const [letto, setLetto] = useState<string | null>(null);
  const [titolo, setTitolo] = useState('');
  const [porzioni, setPorzioni] = useState('2');
  const [preparazione, setPreparazione] = useState('');
  const [cottura, setCottura] = useState('');
  const [fonte, setFonte] = useState('');
  const [tag, setTag] = useState<string[]>([]);
  const [righe, setRighe] = useState<Riga[]>([]);
  const [passaggi, setPassaggi] = useState('');
  const [valori, setValori] = useState(TESTI_VUOTI);
  /** riga per cui si sta scegliendo l'ingrediente; 'nuova' = si sta aggiungendo una riga */
  const [scelta, setScelta] = useState<number | 'nuova' | null>(null);
  // ingredienti creati qui: servono subito, prima che il catalogo venga riletto
  const [creati, setCreati] = useState<Ingrediente[]>([]);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const catalogo = useMemo(() => [...dati.ingredienti, ...creati.filter((c) => !dati.ingredienti.some((i) => i.id === c.id))], [dati.ingredienti, creati]);
  const tagScelti = dati.tag.filter((t) => !t.automatico);
  const daCollegare = righe.filter((r) => !r.ingrediente).length;

  function riempi() {
    const r = leggiTestoRicetta(incollato);
    if (r.titolo) setTitolo(r.titolo);
    if (r.porzioni) setPorzioni(String(r.porzioni));
    setRighe(
      r.ingredienti.map((i) => {
        const trovato = trovaNelCatalogo(i.nome, catalogo);
        const adattata = trovato ? adattaQuantita(i, trovato) : { quantita: i.quantita, daControllare: true };
        return {
          chiave: prossimaChiave++,
          testo: i.testo,
          ingrediente: trovato,
          quantita: adattata.quantita === null ? '' : String(adattata.quantita).replace('.', ','),
          daControllare: adattata.daControllare,
        };
      }),
    );
    setPassaggi(r.passaggi.join('\n'));
    setLetto(
      r.ingredienti.length === 0 && r.passaggi.length === 0
        ? 'Non ho riconosciuto ingredienti né passaggi: scrivili qui sotto.'
        : `Ho riconosciuto ${r.ingredienti.length} ingredienti e ${r.passaggi.length} passaggi. Controlla tutto prima di salvare, soprattutto le righe segnate.`,
    );
  }

  const cambiaRiga = (chiave: number, campi: Partial<Riga>) => setRighe((r) => r.map((x) => (x.chiave === chiave ? { ...x, ...campi } : x)));

  function ingredienteScelto(i: Ingrediente) {
    if (!dati.ingredienti.some((x) => x.id === i.id)) setCreati((c) => [...c, i]);
    if (scelta === 'nuova') setRighe((r) => [...r, { chiave: prossimaChiave++, testo: null, ingrediente: i, quantita: '', daControllare: false }]);
    else if (scelta !== null) cambiaRiga(scelta, { ingrediente: i, daControllare: true });
    setScelta(null);
  }

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (!titolo.trim() || daCollegare > 0) return;
    setAttesa(true);
    setErrore(null);
    try {
      const { data: id, error } = await supabase.rpc('importa_ricetta', {
        p_casa: casa.id,
        p: {
          titolo: titolo.trim(),
          porzioni: leggiNumero(porzioni) || 2,
          minuti_preparazione: leggiNumero(preparazione),
          minuti_cottura: leggiNumero(cottura),
          reel_url: fonte.trim() || null,
          passaggi: passaggi.split('\n').map((p) => p.trim()).filter(Boolean),
          tag: dati.tag.filter((t) => tag.includes(t.id)).map((t) => t.nome),
          ingredienti: righe.map((r) => ({
            nome: r.ingrediente!.nome,
            quantita: leggiNumero(r.quantita) || null,
            unita: r.ingrediente!.unita_base,
            testo_originale: r.testo,
          })),
        },
      });
      if (error) throw new Error(error.message);

      // valori scritti a mano, oppure stimati dagli ingredienti
      const scritti = { kcal: leggiNumero(valori.kcal), proteine_g: leggiNumero(valori.proteine_g), carboidrati_g: leggiNumero(valori.carboidrati_g), grassi_g: leggiNumero(valori.grassi_g) };
      if (Object.values(scritti).some((v) => v !== null)) {
        await supabase.from('ricette').update({ ...scritti, valori_fonte: 'dichiarati' }).eq('id', id);
      } else {
        const stima = await supabase.rpc('stima_valori_ricetta', { p_ricetta: id });
        const s = (stima.data as { kcal: number | null; proteine_g: number | null; carboidrati_g: number | null; grassi_g: number | null }[] | null)?.[0];
        if (s && s.kcal !== null) {
          await supabase.from('ricette').update({ kcal: s.kcal, proteine_g: s.proteine_g, carboidrati_g: s.carboidrati_g, grassi_g: s.grassi_g, valori_fonte: 'stimati' }).eq('id', id);
        }
      }
      await ricarica();
      vai(`/ricetta/${id as string}`);
    } catch (err) {
      setErrore(`Ricetta non salvata: ${(err as Error).message}. Controlla la connessione e riprova.`);
      setAttesa(false);
    }
  }

  if (scelta !== null) {
    const riga = scelta === 'nuova' ? null : righe.find((r) => r.chiave === scelta);
    return (
      <main className="nuova-ricetta">
        <button className="indietro secondario" onClick={() => setScelta(null)}>
          <Freccia />
          Torna alla ricetta
        </button>
        <header className="ricetta-testa">
          <h1>{riga?.testo ? `«${riga.testo}»` : 'Aggiungi un ingrediente'}</h1>
          {riga?.testo && <p className="origine">A quale ingrediente corrisponde?</p>}
        </header>
        <ScegliIngrediente dati={{ ...dati, ingredienti: catalogo }} casa={casa} nomeNuovo={riga?.testo ? '' : ''} ricarica={ricarica} scegli={ingredienteScelto} />
      </main>
    );
  }

  return (
    <main className="nuova-ricetta">
      <button className="indietro secondario" onClick={tornaAllElenco}>
        <Freccia />
        Ricette
      </button>
      <header className="ricetta-testa">
        <h1>Nuova ricetta</h1>
      </header>

      <section className="incolla">
        <label htmlFor="nr-incolla">Hai già il testo? Incollalo qui</label>
        <textarea
          id="nr-incolla"
          rows={5}
          placeholder="Copia la ricetta da un sito o da un’altra app e incollala: provo a riempire il modulo."
          value={incollato}
          onChange={(e) => setIncollato(e.target.value)}
        />
        <button type="button" className="contorno" disabled={!incollato.trim()} onClick={riempi}>
          Riempi il modulo
        </button>
        {letto && (
          <p className="stato-rete" role="status">
            {letto}
          </p>
        )}
      </section>

      <form className="modulo" onSubmit={salva}>
        <label htmlFor="nr-titolo">Titolo</label>
        <input id="nr-titolo" value={titolo} onChange={(e) => setTitolo(e.target.value)} />

        <div className="tre-campi">
          <div>
            <label htmlFor="nr-porzioni">Porzioni</label>
            <input id="nr-porzioni" inputMode="decimal" value={porzioni} onChange={(e) => setPorzioni(e.target.value)} />
          </div>
          <div>
            <label htmlFor="nr-prep">Preparazione (min)</label>
            <input id="nr-prep" inputMode="numeric" value={preparazione} onChange={(e) => setPreparazione(e.target.value)} />
          </div>
          <div>
            <label htmlFor="nr-cottura">Cottura (min)</label>
            <input id="nr-cottura" inputMode="numeric" value={cottura} onChange={(e) => setCottura(e.target.value)} />
          </div>
        </div>

        <fieldset className="scelta-tag">
          <legend>Tag</legend>
          <div className="filtri a-capo">
            {tagScelti.map((t) => (
              <button key={t.id} type="button" className="filtro" aria-pressed={tag.includes(t.id)} onClick={() => setTag(tag.includes(t.id) ? tag.filter((x) => x !== t.id) : [...tag, t.id])}>
                {t.nome}
              </button>
            ))}
          </div>
          <p className="nota">Per farla proporre a pranzo o a cena scegli primo, secondo o piatto unico.</p>
        </fieldset>

        <fieldset className="righe-ingredienti">
          <legend>Ingredienti</legend>
          {righe.length === 0 && <p className="nota">Ancora nessun ingrediente.</p>}
          {righe.map((r) => (
            <div key={r.chiave} className="riga-ingrediente" data-da-controllare={r.daControllare || !r.ingrediente}>
              <div className="chi">
                {r.ingrediente ? (
                  <button type="button" className="secondario nome-ingrediente" onClick={() => setScelta(r.chiave)}>
                    {maiuscola(r.ingrediente.nome)}
                  </button>
                ) : (
                  <button type="button" className="contorno nome-ingrediente" onClick={() => setScelta(r.chiave)}>
                    Scegli l’ingrediente
                  </button>
                )}
                {r.testo && <span className="originale">{r.testo}</span>}
              </div>
              <span className="campo-unita">
                <input
                  inputMode="decimal"
                  aria-label={`Quantità di ${r.ingrediente?.nome ?? r.testo ?? 'ingrediente'}`}
                  placeholder="q.b."
                  value={r.quantita}
                  onChange={(e) => cambiaRiga(r.chiave, { quantita: e.target.value, daControllare: false })}
                />
                <span>{r.ingrediente ? UNITA[r.ingrediente.unita_base] : ''}</span>
              </span>
              <button type="button" className="secondario togli" aria-label={`Togli ${r.ingrediente?.nome ?? r.testo ?? 'ingrediente'}`} onClick={() => setRighe(righe.filter((x) => x.chiave !== r.chiave))}>
                Togli
              </button>
            </div>
          ))}
          {righe.some((r) => r.daControllare && r.ingrediente) && (
            <p className="nota">Le righe segnate hanno una quantità convertita o stimata: controllala. Lascia vuoto per «quanto basta».</p>
          )}
          <button type="button" className="contorno" onClick={() => setScelta('nuova')}>
            Aggiungi un ingrediente
          </button>
        </fieldset>

        <label htmlFor="nr-passaggi">Passaggi, uno per riga</label>
        <textarea id="nr-passaggi" rows={7} value={passaggi} onChange={(e) => setPassaggi(e.target.value)} />

        <fieldset>
          <legend>Valori per porzione</legend>
          <p className="nota">Se li lasci vuoti li calcolo dagli ingredienti.</p>
          <CampiValori id="nr" testi={valori} cambia={setValori} />
        </fieldset>

        <label htmlFor="nr-fonte">Da dove viene (facoltativo)</label>
        <input id="nr-fonte" type="url" inputMode="url" placeholder="https://…" value={fonte} onChange={(e) => setFonte(e.target.value)} />

        {errore && (
          <p role="alert" className="errore">
            {errore}
          </p>
        )}
        {daCollegare > 0 && (
          <p className="nota">
            {daCollegare === 1 ? 'Manca un ingrediente da scegliere' : `Mancano ${daCollegare} ingredienti da scegliere`}: tocca «Scegli l’ingrediente», oppure togli la riga.
          </p>
        )}
        <button type="submit" disabled={attesa || !titolo.trim() || daCollegare > 0}>
          {attesa ? 'Salvataggio…' : 'Salva la ricetta'}
        </button>
      </form>
    </main>
  );
}

function Freccia() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
