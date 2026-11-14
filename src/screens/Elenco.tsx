import { useMemo, useState } from 'react';
import { formattaMinuti, formattaValore, semplifica, type Dati, type Ricetta } from '../lib/dati';
import { passwordImpostata } from '../lib/password';
import { vai } from '../lib/rotta';
import { Miniatura } from './Copertina';

export type Ordine = 'nome' | 'proteine' | 'kcal' | 'resa';
export type Filtri = {
  testo: string;
  tag: string[];
  minuti: number | null;
  /** valori per porzione: massimo di kcal, carboidrati e grassi, minimo di proteine */
  kcalMax: number | null;
  proteineMin: number | null;
  carboidratiMax: number | null;
  grassiMax: number | null;
  ordine: Ordine;
};
export const FILTRI_VUOTI: Filtri = {
  testo: '',
  tag: [],
  minuti: null,
  kcalMax: null,
  proteineMin: null,
  carboidratiMax: null,
  grassiMax: null,
  ordine: 'nome',
};

const ORDINI: { valore: Ordine; etichetta: string }[] = [
  { valore: 'nome', etichetta: 'Nome' },
  { valore: 'proteine', etichetta: 'Più proteine' },
  { valore: 'kcal', etichetta: 'Meno calorie' },
  { valore: 'resa', etichetta: 'Più proteine per caloria' },
];

const oltre = (valore: number | null, massimo: number | null) => massimo !== null && (valore === null || valore > massimo);

/** Chiave di ordinamento: più piccola = prima. Le ricette senza valori finiscono in fondo. */
function chiave(r: Ricetta, ordine: Ordine): number {
  if (ordine === 'proteine') return r.proteine_g === null ? Infinity : -r.proteine_g;
  if (ordine === 'kcal') return r.kcal ?? Infinity;
  if (ordine === 'resa') return r.proteine_g === null || !r.kcal ? Infinity : -r.proteine_g / r.kcal;
  return 0;
}

const numero = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
};

const TEMPI = [
  { minuti: 30, etichetta: 'fino a 30 min' },
  { minuti: 45, etichetta: 'fino a 45 min' },
  { minuti: 60, etichetta: 'fino a 1 ora' },
];

function corrisponde(r: Ricetta, f: Filtri, parole: string[]): boolean {
  if (f.minuti !== null && (r.minuti_totali === null || r.minuti_totali > f.minuti)) return false;
  if (!f.tag.every((id) => r.tag.some((t) => t.id === id))) return false;
  if (oltre(r.kcal, f.kcalMax) || oltre(r.carboidrati_g, f.carboidratiMax) || oltre(r.grassi_g, f.grassiMax)) return false;
  if (f.proteineMin !== null && (r.proteine_g === null || r.proteine_g < f.proteineMin)) return false;
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
    const scelte = dati.ricette.filter((r) => corrisponde(r, filtri, parole));
    // l'elenco arriva già in ordine di nome: sort è stabile, quindi a parità di chiave resta quello
    return filtri.ordine === 'nome' ? scelte : [...scelte].sort((a, b) => chiave(a, filtri.ordine) - chiave(b, filtri.ordine));
  }, [dati.ricette, filtri]);

  // si propongono solo i tag usati da almeno una ricetta
  const tagUsati = useMemo(
    () => dati.tag.filter((t) => dati.ricette.some((r) => r.tag.some((x) => x.id === t.id))),
    [dati],
  );

  const sogliaValori = [filtri.kcalMax, filtri.proteineMin, filtri.carboidratiMax, filtri.grassiMax].filter((v) => v !== null).length;
  const valoriAttivi = sogliaValori + (filtri.ordine !== 'nome' ? 1 : 0);
  const [valoriAperti, setValoriAperti] = useState(valoriAttivi > 0);
  const senzaValori = dati.ricette.filter((r) => r.kcal === null && r.proteine_g === null).length;
  const attivi = filtri.tag.length + (filtri.minuti !== null ? 1 : 0) + (filtri.testo.trim() ? 1 : 0) + valoriAttivi;
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
            <button
              className="filtro valori"
              aria-expanded={valoriAperti}
              aria-controls="pannello-valori"
              data-attivo={valoriAttivi > 0}
              onClick={() => setValoriAperti(!valoriAperti)}
            >
              Valori nutrizionali{valoriAttivi > 0 ? ` (${valoriAttivi})` : ''}
            </button>
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

          {valoriAperti && (
            <div className="pannello-valori" id="pannello-valori">
              <p className="nota">Per porzione. Lascia vuoto quello che non ti interessa.</p>
              <div className="soglie">
                {(
                  [
                    ['kcalMax', 'Calorie, al massimo', 'kcal'],
                    ['proteineMin', 'Proteine, almeno', 'g'],
                    ['carboidratiMax', 'Carboidrati, al massimo', 'g'],
                    ['grassiMax', 'Grassi, al massimo', 'g'],
                  ] as const
                ).map(([campo, etichetta, unita]) => (
                  <div key={campo}>
                    <label htmlFor={`v-${campo}`}>{etichetta}</label>
                    <span className="campo-unita">
                      <input
                        id={`v-${campo}`}
                        inputMode="decimal"
                        defaultValue={filtri[campo] ?? ''}
                        onChange={(e) => setFiltri({ ...filtri, [campo]: numero(e.target.value) })}
                      />
                      <span>{unita}</span>
                    </span>
                  </div>
                ))}
              </div>
              <label htmlFor="v-ordine">Ordina per</label>
              <select id="v-ordine" value={filtri.ordine} onChange={(e) => setFiltri({ ...filtri, ordine: e.target.value as Ordine })}>
                {ORDINI.map((o) => (
                  <option key={o.valore} value={o.valore}>
                    {o.etichetta}
                  </option>
                ))}
              </select>
              {senzaValori > 0 && (
                <p className="nota">
                  {senzaValori === 1 ? '1 ricetta non ha' : `${senzaValori} ricette non hanno`} valori nutrizionali:{' '}
                  {sogliaValori > 0
                    ? `con questi filtri non ${senzaValori === 1 ? 'compare' : 'compaiono'}.`
                    : `ordinando per valori ${senzaValori === 1 ? 'finisce' : 'finiscono'} in fondo.`}
                </p>
              )}
            </div>
          )}

          <p className="conteggio" aria-live="polite">
            {attivi === 0
              ? totale === 1
                ? '1 ricetta'
                : `${totale} ricette`
              : `${trovate.length} di ${totale}`}
            {attivi > 0 && (
              <button
                className="secondario"
                onClick={() => {
                  setFiltri(FILTRI_VUOTI);
                  setValoriAperti(false);
                }}
              >
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
                    <Miniatura ricetta={r} />
                    <span className="testi">
                      <span className="titolo">{r.titolo}</span>
                      <span className="dettagli">
                        {[
                          formattaMinuti(r.minuti_totali),
                          r.kcal !== null && `${formattaValore(r.kcal)} kcal`,
                          r.proteine_g !== null && `${formattaValore(r.proteine_g)} g proteine`,
                          ...r.tag.map((t) => t.nome),
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                      {r.da_verificare && <span className="da-verificare">Da verificare</span>}
                    </span>
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
