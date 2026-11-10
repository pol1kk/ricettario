import { useState } from 'react';
import { formattaMinuti, formattaQuantita, type Ricetta } from '../lib/dati';
import { tornaAllElenco } from '../lib/rotta';

/** Raggruppa elementi consecutivi con lo stesso gruppo, mantenendo l'ordine della ricetta. */
function aGruppi<T extends { gruppo?: string | null }>(elementi: T[]): { gruppo: string | null; elementi: T[] }[] {
  const out: { gruppo: string | null; elementi: T[] }[] = [];
  for (const e of elementi) {
    const g = e.gruppo ?? null;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.gruppo === g) ultimo.elementi.push(e);
    else out.push({ gruppo: g, elementi: [e] });
  }
  return out;
}

// Il testo del reel si mostra solo se aggiunge qualcosa ("3 cucchiai", "mezza cipolla"),
// non quando ripete la quantità già scritta a sinistra ("150 ml di vino rosso").
const RIPETE_LA_QUANTITA = /^\d+([.,]\d+)?\s?(g|gr|kg|ml|cl|l)\b/i;

function Indietro() {
  return (
    <button className="indietro secondario" onClick={tornaAllElenco}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Ricette
    </button>
  );
}

export default function SchedaRicetta({ ricetta }: { ricetta: Ricetta | undefined }) {
  const [porzioni, setPorzioni] = useState(ricetta?.porzioni ?? 2);
  const [usati, setUsati] = useState<Set<string>>(new Set());
  const [fatti, setFatti] = useState<Set<number>>(new Set());

  if (!ricetta) {
    return (
      <main>
        <Indietro />
        <section className="vuoto">
          <h2>Ricetta non trovata</h2>
          <p>Potrebbe essere stata eliminata. Torna all'elenco per vedere quelle disponibili.</p>
        </section>
      </main>
    );
  }

  const fattore = porzioni / ricetta.porzioni;
  const alterna = <T,>(insieme: Set<T>, v: T) => {
    const nuovo = new Set(insieme);
    if (!nuovo.delete(v)) nuovo.add(v);
    return nuovo;
  };

  const tempi = [
    ['Preparazione', formattaMinuti(ricetta.minuti_preparazione)],
    ['Cottura', formattaMinuti(ricetta.minuti_cottura)],
    ['In tutto', formattaMinuti(ricetta.minuti_totali)],
  ].filter((t): t is [string, string] => t[1] !== null);

  let numeroPassaggio = 0;
  const passaggi = ricetta.passaggi.map((p, i) => ({ ...p, i }));

  return (
    <main className="ricetta">
      <Indietro />

      <header className="ricetta-testa">
        <h1>{ricetta.titolo}</h1>
        {(ricetta.autore || ricetta.reel_url) && (
          <p className="origine">
            {ricetta.autore && <>Di {ricetta.autore}. </>}
            {ricetta.reel_url && (
              <a href={ricetta.reel_url} target="_blank" rel="noreferrer">
                Guarda il reel
              </a>
            )}
          </p>
        )}
        {ricetta.tag.length > 0 && (
          <p className="tag-ricetta">
            {ricetta.tag.map((t) => (
              <span key={t.id} className="chip">
                {t.nome}
              </span>
            ))}
          </p>
        )}
        {tempi.length > 0 && (
          <dl className="tempi">
            {tempi.map(([nome, valore]) => (
              <div key={nome}>
                <dt>{nome}</dt>
                <dd>{valore}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {ricetta.da_verificare && (
        <p className="verifica">
          <strong>Da verificare.</strong> {ricetta.note_verifica ?? 'Alcune quantità sono stimate.'}
        </p>
      )}

      <section aria-labelledby="t-ingredienti">
        <div className="sezione-testa">
          <h2 id="t-ingredienti">Ingredienti</h2>
          <div className="porzioni" role="group" aria-label="Porzioni">
            <button aria-label="Una porzione in meno" disabled={porzioni <= 1} onClick={() => setPorzioni(porzioni - 1)}>
              −
            </button>
            <output aria-live="polite">
              {porzioni} {porzioni === 1 ? 'porzione' : 'porzioni'}
            </output>
            <button aria-label="Una porzione in più" disabled={porzioni >= 24} onClick={() => setPorzioni(porzioni + 1)}>
              +
            </button>
          </div>
        </div>

        {aGruppi(ricetta.ingredienti).map((g, n) => (
          <div key={n} className="gruppo">
            {g.gruppo && <h3>{g.gruppo}</h3>}
            <ul className="ingredienti">
              {g.elementi.map((i) => (
                <li key={i.id}>
                  <button aria-pressed={usati.has(i.id)} onClick={() => setUsati(alterna(usati, i.id))}>
                    <span className="quanto">{formattaQuantita(i.quantita, i.unita, fattore)}</span>
                    <span className="cosa">
                      {i.nome}
                      {i.facoltativo && <em> (facoltativo)</em>}
                      {fattore === 1 && i.testo_originale && !RIPETE_LA_QUANTITA.test(i.testo_originale) && (
                        <small>{i.testo_originale}</small>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {fattore !== 1 && (
          <p className="nota ricalcolo">
            Quantità ricalcolate e arrotondate da {ricetta.porzioni} porzioni.{' '}
            <button className="secondario" onClick={() => setPorzioni(ricetta.porzioni)}>
              Torna alle dosi originali
            </button>
          </p>
        )}
      </section>

      {passaggi.length > 0 && (
        <section aria-labelledby="t-procedimento">
          <div className="sezione-testa">
            <h2 id="t-procedimento">Procedimento</h2>
          </div>
          {aGruppi(passaggi).map((g, n) => (
            <div key={n} className="gruppo">
              {g.gruppo && <h3>{g.gruppo}</h3>}
              <ol className="passaggi" start={numeroPassaggio + 1}>
                {g.elementi.map((p) => {
                  numeroPassaggio += 1;
                  return (
                    <li key={p.i}>
                      <button aria-pressed={fatti.has(p.i)} onClick={() => setFatti(alterna(fatti, p.i))}>
                        <span className="numero" aria-hidden="true">
                          {numeroPassaggio}
                        </span>
                        <span className="testo">{p.testo}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      )}

      {ricetta.note && (
        <section aria-labelledby="t-note">
          <div className="sezione-testa">
            <h2 id="t-note">Note</h2>
          </div>
          <p className="note-ricetta">{ricetta.note}</p>
        </section>
      )}
    </main>
  );
}
