import { useEffect, useState } from 'react';
import { formattaQuantita, type Casa, type Ricetta } from '../lib/dati';
import { PASTI, segnaCucinataOggi, nomePorzioni, type Pasto } from '../lib/piano';
import { aggiungiVoce, dataDiOggi, valoriRicetta } from '../lib/diario';
import { tornaAllElenco } from '../lib/rotta';
import ScaricoDispensa from './ScaricoDispensa';
import { usaSchermoAcceso } from '../lib/schermo';
import Copertina from './Copertina';
import Porzioni from './Porzioni';

// Il punto a cui si è arrivati resta salvato finché la scheda è aperta:
// se l'app viene ricaricata per sbaglio a metà ricetta, si riparte da lì.
type Avanzamento = { porzioni: number; passo: number; usati: string[] };
const chiave = (id: string) => `ricettario.cucina.${id}`;

function leggi(id: string): Avanzamento | null {
  try {
    const testo = sessionStorage.getItem(chiave(id));
    return testo ? (JSON.parse(testo) as Avanzamento) : null;
  } catch {
    return null;
  }
}

function scrivi(id: string, a: Avanzamento | null) {
  try {
    if (a) sessionStorage.setItem(chiave(id), JSON.stringify(a));
    else sessionStorage.removeItem(chiave(id));
  } catch {
    /* senza archivio si cucina lo stesso, solo non si ritrova il punto dopo una ricarica */
  }
}

/** Chiamata dalla scheda ricetta: fa partire la modalità cucina dall'inizio, con le porzioni scelte lì. */
export function avviaCucina(id: string, porzioni: number) {
  if (!leggi(id)) scrivi(id, { porzioni, passo: -1, usati: [] });
}

type Vista = 'passo' | 'tutti' | 'ingredienti';

export default function Cucina({
  ricetta,
  casa,
  ricarica,
}: {
  ricetta: Ricetta | undefined;
  casa: Casa;
  ricarica: () => Promise<void>;
}) {
  const [stato, setStato] = useState<Avanzamento>(
    () => (ricetta && leggi(ricetta.id)) || { porzioni: ricetta?.porzioni ?? casa.porzioni_predefinite, passo: -1, usati: [] },
  );
  const [vista, setVista] = useState<Vista>('passo');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<Pasto | null>(null);
  const [nelDiario, setNelDiario] = useState<'no' | 'attesa' | 'si'>('no');
  usaSchermoAcceso(true);

  const id = ricetta?.id;
  useEffect(() => {
    if (id && !fatto) scrivi(id, stato);
  }, [id, stato, fatto]);

  if (!ricetta) {
    return (
      <main>
        <button className="indietro secondario" onClick={tornaAllElenco}>
          Indietro
        </button>
        <section className="vuoto">
          <h2>Ricetta non trovata</h2>
          <p>Torna all'elenco per vedere quelle disponibili.</p>
        </section>
      </main>
    );
  }

  const passi = ricetta.passaggi;
  const { porzioni, passo } = stato;
  const fattore = porzioni / ricetta.porzioni;
  const ultimo = passo === passi.length - 1;

  const vaiAlPasso = (n: number) => {
    setStato({ ...stato, passo: n });
    setVista('passo');
    window.scrollTo(0, 0);
  };

  const alterna = (ingrediente: string) =>
    setStato({
      ...stato,
      usati: stato.usati.includes(ingrediente) ? stato.usati.filter((x) => x !== ingrediente) : [...stato.usati, ingrediente],
    });

  async function finisci() {
    setAttesa(true);
    setErrore(null);
    try {
      const pasto = await segnaCucinataOggi(casa.id, ricetta!.id, porzioni);
      scrivi(ricetta!.id, null);
      setFatto(pasto);
      window.scrollTo(0, 0);
    } catch (e) {
      setErrore(`Non sono riuscito a segnarla come cucinata: ${(e as Error).message}. Controlla la connessione e riprova.`);
    }
    setAttesa(false);
  }

  async function aggiungiAlDiario() {
    setNelDiario('attesa');
    setErrore(null);
    try {
      await aggiungiVoce({
        data: dataDiOggi(),
        pasto: fatto!,
        nome: ricetta!.titolo,
        ricetta_id: ricetta!.id,
        ingrediente_id: null,
        piano_id: null,
        quantita: 1,
        unita: 'porzioni',
        ...valoriRicetta(ricetta!, 1),
      });
      setNelDiario('si');
    } catch (e) {
      setErrore(`Non aggiunta al diario: ${(e as Error).message}. Controlla la connessione e riprova.`);
      setNelDiario('no');
    }
  }

  const ingredienti = (
    <ul className="ingredienti">
      {ricetta.ingredienti.map((i, n) => (
        <li key={i.id}>
          {i.gruppo && i.gruppo !== ricetta.ingredienti[n - 1]?.gruppo && <h3>{i.gruppo}</h3>}
          <button aria-pressed={stato.usati.includes(i.id)} onClick={() => alterna(i.id)}>
            <span className="quanto">{formattaQuantita(i.quantita, i.unita, fattore)}</span>
            <span className="icona" aria-hidden="true">
              {i.icona}
            </span>
            <span className="cosa">
              {i.nome}
              {i.facoltativo && <em> (facoltativo)</em>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (fatto) {
    return (
      <main className="cucina finita">
        <header className="ricetta-testa">
          <h1>Ricetta finita</h1>
          <p className="origine">
            {ricetta.titolo}: segnata come cucinata oggi, {PASTI.find((p) => p.valore === fatto)!.nome.toLowerCase()},{' '}
            {nomePorzioni(porzioni)}.
          </p>
        </header>
        <div className="foto-finale">
          <p className="nota">{ricetta.copertina_url ? 'Vuoi aggiornare la foto del piatto?' : 'Vuoi aggiungere la foto del piatto?'}</p>
          <Copertina ricetta={ricetta} casaId={casa.id} ricarica={ricarica} />
        </div>
        <ScaricoDispensa casa={casa} ricetta={ricetta} porzioni={porzioni} />
        <div className="finale-diario">
          {nelDiario === 'si' ? (
            <p className="nota" role="status">
              Aggiunta al tuo diario di oggi: 1 porzione. Dal Diario puoi cambiare quantità e pasto.
            </p>
          ) : (
            <button className="contorno" disabled={nelDiario === 'attesa'} onClick={aggiungiAlDiario}>
              {nelDiario === 'attesa' ? 'Salvataggio…' : 'L’ho mangiata: aggiungi al diario'}
            </button>
          )}
          {errore && (
            <p role="alert" className="errore">
              {errore}
            </p>
          )}
        </div>
        <button onClick={() => tornaAllElenco()}>Torna alla ricetta</button>
      </main>
    );
  }

  return (
    <main className="cucina">
      <div className="barra">
        <button className="indietro secondario" onClick={tornaAllElenco}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Esci
        </button>
        {ricetta.reel_url && (
          <a className="reel" href={ricetta.reel_url} target="_blank" rel="noreferrer">
            Guarda il reel
          </a>
        )}
      </div>

      <p className="titolo-cucina">{ricetta.titolo}</p>

      {passo >= 0 && (
        <div className="viste" role="group" aria-label="Cosa vedere">
          {(
            [
              ['passo', 'Un passaggio'],
              ['tutti', 'Tutti i passaggi'],
              ['ingredienti', 'Ingredienti'],
            ] as const
          ).map(([valore, nome]) => (
            <button key={valore} aria-pressed={vista === valore} onClick={() => setVista(valore)}>
              {nome}
            </button>
          ))}
        </div>
      )}

      {passo < 0 ? (
        <section className="preparazione">
          <h1>Prepara gli ingredienti</h1>
          <div className="riga-porzioni">
            <span>Porzioni</span>
            <Porzioni valore={porzioni} cambia={(n) => setStato({ ...stato, porzioni: n })} />
          </div>
          <p className="nota">Tocca un ingrediente quando l'hai tirato fuori.</p>
          {ingredienti}
        </section>
      ) : vista === 'ingredienti' ? (
        <section>
          <p className="nota">Per {nomePorzioni(porzioni)}.</p>
          {ingredienti}
        </section>
      ) : vista === 'tutti' ? (
        <ol className="tutti-i-passi">
          {passi.map((p, n) => (
            <li key={n}>
              {p.gruppo && p.gruppo !== passi[n - 1]?.gruppo && <h3>{p.gruppo}</h3>}
              <button aria-current={n === passo ? 'step' : undefined} data-fatto={n < passo} onClick={() => vaiAlPasso(n)}>
                <span className="numero" aria-hidden="true">
                  {n + 1}
                </span>
                <span className="testo">{p.testo}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <section className="passo" key={passo} aria-live="polite">
          <div className="avanzamento">
            <p>
              Passaggio {passo + 1} di {passi.length}
              {passi[passo].gruppo && <span>, {passi[passo].gruppo}</span>}
            </p>
            <div className="binario" aria-hidden="true">
              <div style={{ width: `${((passo + 1) / passi.length) * 100}%` }} />
            </div>
          </div>
          <p className="testo-passo">{passi[passo].testo}</p>
        </section>
      )}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      <div className="comandi-cucina">
        {passo < 0 ? (
          passi.length > 0 ? (
            <button onClick={() => vaiAlPasso(0)}>Inizia a cucinare</button>
          ) : (
            <button disabled={attesa} onClick={finisci}>
              {attesa ? 'Salvataggio…' : 'Ho finito'}
            </button>
          )
        ) : (
          <>
            <button className="contorno" onClick={() => vaiAlPasso(passo - 1)}>
              {passo === 0 ? 'Ingredienti' : 'Indietro'}
            </button>
            {ultimo ? (
              <button disabled={attesa} onClick={finisci}>
                {attesa ? 'Salvataggio…' : 'Ho finito'}
              </button>
            ) : (
              <button onClick={() => vaiAlPasso(passo + 1)}>Avanti</button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
