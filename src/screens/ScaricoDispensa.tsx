import { useEffect, useMemo, useState } from 'react';
import { formattaQuantita, type Casa, type Ricetta } from '../lib/dati';
import { leggiNumero } from '../lib/diario';
import { leggiDispensa, riassumiDispensa, scalaDispensa, type Confezione } from '../lib/dispensa';

const UNITA = { g: 'g', ml: 'ml', unita: 'pezzi' } as const;
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Riga = { ingrediente_id: string; nome: string; unita: 'g' | 'ml' | 'unita'; ha: number; quantita: string; scelta: boolean };

/**
 * Dopo aver cucinato: propone di togliere dalla dispensa gli ingredienti usati, con quantità correggibili.
 * Mostra solo gli ingredienti che si contano e che in dispensa ci sono; se non ce n'è nessuno non mostra nulla.
 */
export default function ScaricoDispensa({
  casa,
  ricetta,
  porzioni,
  chiuso,
}: {
  casa: Casa;
  ricetta: Ricetta;
  /** porzioni cucinate */
  porzioni: number;
  /** chiamata quando la proposta si chiude: scalato, rimandato, oppure niente da scalare */
  chiuso?: (scalato: boolean) => void;
}) {
  const [confezioni, setConfezioni] = useState<Confezione[] | null>(null);
  const [righe, setRighe] = useState<Riga[]>([]);
  const [stato, setStato] = useState<'aperto' | 'attesa' | 'fatto' | 'saltato'>('aperto');
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    leggiDispensa(casa.id).then(setConfezioni, () => setConfezioni([]));
  }, [casa.id]);

  const proposte = useMemo(() => {
    if (!confezioni) return null;
    const dispensa = riassumiDispensa(confezioni);
    const fattore = porzioni / ricetta.porzioni;
    const elenco: Riga[] = [];
    for (const i of ricetta.ingredienti) {
      const c = dispensa.get(i.ingrediente_id);
      if (i.base || i.quantita === null || !i.unita || !c || c.quantita <= 0) continue;
      const serve = i.quantita * fattore;
      const usa = Math.min(serve, c.quantita);
      elenco.push({
        ingrediente_id: i.ingrediente_id,
        nome: i.nome,
        unita: i.unita,
        ha: c.quantita,
        quantita: String(i.unita === 'unita' ? Math.round(usa * 100) / 100 : Math.round(usa)).replace('.', ','),
        scelta: !i.facoltativo,
      });
    }
    return elenco;
  }, [confezioni, ricetta, porzioni]);

  useEffect(() => {
    if (!proposte) return;
    setRighe(proposte);
    if (proposte.length === 0) chiuso?.(false);
    // la proposta si calcola una volta, quando arriva la dispensa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposte]);

  if (!proposte || proposte.length === 0 || stato === 'saltato') return null;

  if (stato === 'fatto') {
    return (
      <section className="scarico" role="status">
        <p className="nota">Dispensa aggiornata: ho tolto gli ingredienti usati.</p>
      </section>
    );
  }

  const cambia = (id: string, campi: Partial<Riga>) => setRighe((r) => r.map((x) => (x.ingrediente_id === id ? { ...x, ...campi } : x)));
  const daScalare = righe
    .filter((r) => r.scelta)
    .map((r) => ({ ingrediente_id: r.ingrediente_id, quantita: leggiNumero(r.quantita) ?? 0 }))
    .filter((r) => r.quantita > 0);

  async function scala() {
    setStato('attesa');
    setErrore(null);
    try {
      await scalaDispensa(casa.id, ricetta.id, daScalare);
      setStato('fatto');
      chiuso?.(true);
    } catch (e) {
      setErrore(`Dispensa non aggiornata: ${(e as Error).message}. Controlla la connessione e riprova.`);
      setStato('aperto');
    }
  }

  return (
    <section className="scarico" aria-label="Togli dalla dispensa">
      <h2>Togli dalla dispensa quello che hai usato</h2>
      <p className="nota">{ricetta.titolo}. Correggi le quantità se ne hai usato di più o di meno.</p>
      <ul>
        {righe.map((r) => (
          <li key={r.ingrediente_id}>
            <label className="spunta">
              <input type="checkbox" checked={r.scelta} onChange={(e) => cambia(r.ingrediente_id, { scelta: e.target.checked })} />
              <span className="testi">
                <span className="titolo">{maiuscola(r.nome)}</span>
                <span className="dettagli">ne hai {formattaQuantita(r.ha, r.unita, 1, false)}</span>
              </span>
            </label>
            <span className="campo-unita">
              <input
                inputMode="decimal"
                aria-label={`Quantità usata di ${r.nome}`}
                disabled={!r.scelta}
                value={r.quantita}
                onChange={(e) => cambia(r.ingrediente_id, { quantita: e.target.value })}
              />
              <span>{UNITA[r.unita]}</span>
            </span>
          </li>
        ))}
      </ul>
      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
      <div className="comandi">
        <button disabled={stato === 'attesa' || daScalare.length === 0} onClick={scala}>
          {stato === 'attesa' ? 'Un momento…' : 'Togli dalla dispensa'}
        </button>
        <button
          className="secondario"
          disabled={stato === 'attesa'}
          onClick={() => {
            setStato('saltato');
            chiuso?.(false);
          }}
        >
          Non ora
        </button>
      </div>
    </section>
  );
}
