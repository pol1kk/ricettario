import { useState, type FormEvent } from 'react';
import type { Casa, Ricetta } from '../lib/dati';
import { giornoRelativo, oggi, piuGiorni } from '../lib/date';
import { PASTI, aggiungiAlPiano, pastoDiAdesso, type Pasto } from '../lib/piano';
import Porzioni from './Porzioni';

type Aperto = 'menu' | 'cucinato' | null;

/** "Aggiungi al menù" e "Ho cucinato", nella scheda della ricetta. */
export default function AzioniRicetta({ ricetta, casa }: { ricetta: Ricetta; casa: Casa }) {
  const [aperto, setAperto] = useState<Aperto>(null);
  const [giorno, setGiorno] = useState(oggi());
  const [pasto, setPasto] = useState<Pasto>(pastoDiAdesso());
  const [porzioni, setPorzioni] = useState(casa.porzioni_predefinite);
  const [attesa, setAttesa] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  const giorni = Array.from({ length: 14 }, (_, i) => piuGiorni(oggi(), i));
  const nomePasto = PASTI.find((p) => p.valore === pasto)!.nome.toLowerCase();

  async function conferma(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setEsito(null);
    const cucinato = aperto === 'cucinato';
    try {
      await aggiungiAlPiano(casa.id, {
        data: cucinato ? oggi() : giorno,
        pasto,
        ricetta_id: ricetta.id,
        porzioni,
        cucinata: cucinato,
      });
      setEsito({
        ok: true,
        testo: cucinato
          ? `Segnata come cucinata oggi, ${nomePasto}.${ricetta.copertina_url ? '' : ' Se vuoi, aggiungi la foto del piatto dalla copertina qui sopra.'}`
          : `Aggiunta al menù: ${giornoRelativo(giorno)}, ${nomePasto}.`,
      });
      setAperto(null);
    } catch (err) {
      setEsito({ ok: false, testo: `Non salvato: ${(err as Error).message}` });
    }
    setAttesa(false);
  }

  const apri = (cosa: Aperto) => {
    setAperto(aperto === cosa ? null : cosa);
    setEsito(null);
    if (cosa === 'cucinato') setPasto(pastoDiAdesso());
  };

  return (
    <div className="azioni-ricetta">
      <div className="coppia">
        <button className="contorno" aria-expanded={aperto === 'menu'} onClick={() => apri('menu')}>
          Aggiungi al menù
        </button>
        <button className="contorno" aria-expanded={aperto === 'cucinato'} onClick={() => apri('cucinato')}>
          Ho cucinato
        </button>
      </div>

      {aperto && (
        <form onSubmit={conferma} className="scheda modulo">
          {aperto === 'menu' && (
            <>
              <label htmlFor="az-giorno">Giorno</label>
              <select id="az-giorno" value={giorno} onChange={(e) => setGiorno(e.target.value)}>
                {giorni.map((g) => (
                  <option key={g} value={g}>
                    {giornoRelativo(g)}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="az-pasto">Pasto</label>
          <select id="az-pasto" value={pasto} onChange={(e) => setPasto(e.target.value as Pasto)}>
            {PASTI.map((p) => (
              <option key={p.valore} value={p.valore}>
                {p.nome}
              </option>
            ))}
          </select>
          <div className="riga-porzioni">
            <span>{aperto === 'menu' ? 'Per quante porzioni' : 'Porzioni cucinate'}</span>
            <Porzioni valore={porzioni} cambia={setPorzioni} />
          </div>
          <div className="azioni">
            <button type="submit" disabled={attesa}>
              {attesa ? 'Salvataggio…' : aperto === 'menu' ? 'Aggiungi al menù' : 'Segna come cucinata oggi'}
            </button>
            <button type="button" className="secondario" onClick={() => setAperto(null)} disabled={attesa}>
              Annulla
            </button>
          </div>
        </form>
      )}

      {esito && (
        <p role={esito.ok ? 'status' : 'alert'} className={esito.ok ? 'fatto' : 'errore'}>
          {esito.testo}
        </p>
      )}
    </div>
  );
}
