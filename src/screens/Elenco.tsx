import { useMemo } from 'react';
import { formattaMinuti, semplifica, type Dati, type Ricetta } from '../lib/dati';
import { passwordImpostata } from '../lib/password';
import { vai } from '../lib/rotta';

export type Filtri = { testo: string; tag: string[]; minuti: number | null };
export const FILTRI_VUOTI: Filtri = { testo: '', tag: [], minuti: null };

const TEMPI = [
  { minuti: 30, etichetta: 'fino a 30 min' },
  { minuti: 45, etichetta: 'fino a 45 min' },
  { minuti: 60, etichetta: 'fino a 1 ora' },
];

function corrisponde(r: Ricetta, f: Filtri, parole: string[]): boolean {
  if (f.minuti !== null && (r.minuti_totali === null || r.minuti_totali > f.minuti)) return false;
  if (!f.tag.every((id) => r.tag.some((t) => t.id === id))) return false;
  return parole.every((p) => r.cerca.includes(p));
}

export default function Elenco({
  dati,
  filtri,
  setFiltri,
}: {
  dati: Dati;
  filtri: Filtri;
  setFiltri: (f: Filtri) => void;
}) {
  const trovate = useMemo(() => {
    const parole = semplifica(filtri.testo).split(/\s+/).filter(Boolean);
    return dati.ricette.filter((r) => corrisponde(r, filtri, parole));
  }, [dati.ricette, filtri]);

  // si propongono solo i tag usati da almeno una ricetta
  const tagUsati = useMemo(
    () => dati.tag.filter((t) => dati.ricette.some((r) => r.tag.some((x) => x.id === t.id))),
    [dati],
  );

  const attivi = filtri.tag.length + (filtri.minuti !== null ? 1 : 0) + (filtri.testo.trim() ? 1 : 0);
  const totale = dati.ricette.length;

  const alternaTag = (id: string) =>
    setFiltri({ ...filtri, tag: filtri.tag.includes(id) ? filtri.tag.filter((x) => x !== id) : [...filtri.tag, id] });

  return (
    <main className="elenco">
      <header className="home-testa">
        <h1>Ricettario</h1>
        <button className="secondario" onClick={() => vai('/impostazioni')}>
          Impostazioni
        </button>
      </header>

      {!passwordImpostata() && (
        <button className="avviso" onClick={() => vai('/impostazioni')}>
          Scegli una password per entrare anche dall'app installata
        </button>
      )}

      {totale === 0 ? (
        <section className="vuoto">
          <h2>Nessuna ricetta, per ora</h2>
          <p>
            Scarica i reel nella cartella Ricette e scrivi a Claude «analizza i nuovi»: le ricette compariranno
            qui.
          </p>
        </section>
      ) : (
        <>
          <div className="ricerca">
            <label htmlFor="cerca" className="solo-lettori">
              Cerca una ricetta
            </label>
            <input
              id="cerca"
              type="search"
              enterKeyHint="search"
              placeholder="Cerca per nome o ingrediente"
              value={filtri.testo}
              onChange={(e) => setFiltri({ ...filtri, testo: e.target.value })}
            />
          </div>

          <div className="filtri" role="group" aria-label="Filtri">
            {tagUsati.map((t, i) => (
              <button
                key={t.id}
                className={`filtro${i > 0 && tagUsati[i - 1].gruppo !== t.gruppo ? ' nuovo-gruppo' : ''}`}
                aria-pressed={filtri.tag.includes(t.id)}
                onClick={() => alternaTag(t.id)}
              >
                {t.nome}
              </button>
            ))}
            {TEMPI.map((t, i) => (
              <button
                key={t.minuti}
                className={`filtro${i === 0 ? ' nuovo-gruppo' : ''}`}
                aria-pressed={filtri.minuti === t.minuti}
                onClick={() => setFiltri({ ...filtri, minuti: filtri.minuti === t.minuti ? null : t.minuti })}
              >
                {t.etichetta}
              </button>
            ))}
          </div>

          <p className="conteggio" aria-live="polite">
            {attivi === 0
              ? totale === 1
                ? '1 ricetta'
                : `${totale} ricette`
              : `${trovate.length} di ${totale}`}
            {attivi > 0 && (
              <button className="secondario" onClick={() => setFiltri(FILTRI_VUOTI)}>
                Togli i filtri
              </button>
            )}
          </p>

          {trovate.length === 0 ? (
            <section className="vuoto piccolo">
              <h2>Nessuna ricetta con questi filtri</h2>
              <p>Prova a toglierne uno, o cerca un ingrediente diverso.</p>
            </section>
          ) : (
            <ul className="ricette">
              {trovate.map((r) => (
                <li key={r.id}>
                  <a
                    href={`#/ricetta/${r.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      vai(`/ricetta/${r.id}`);
                    }}
                  >
                    <span className="titolo">{r.titolo}</span>
                    <span className="dettagli">
                      {[formattaMinuti(r.minuti_totali), ...r.tag.map((t) => t.nome)].filter(Boolean).join(', ')}
                    </span>
                    {r.da_verificare && <span className="da-verificare">Da verificare</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
