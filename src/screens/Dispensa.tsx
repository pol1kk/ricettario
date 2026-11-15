import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { formattaQuantita, leggiCache, scriviCache, type Casa, type Dati, type Ingrediente } from '../lib/dati';
import { consiglia } from '../lib/consiglio';
import { leggiNumero } from '../lib/diario';
import {
  POSIZIONI,
  chiudiConfezione,
  descriviScadenza,
  formattaData,
  leggiData,
  leggiDispensa,
  mascheraData,
  modificaConfezione,
  scalaDispensa,
  type Confezione,
  type Posizione,
  type StatoScorta,
} from '../lib/dispensa';
import { aggiungi, usaLista } from '../lib/lista';
import { vai } from '../lib/rotta';
import AggiungiADispensa from './AggiungiADispensa';
import { IconaCodice } from './ModuloConfezione';
import SchedeDispensa from './SchedeDispensa';

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const UNITA = { g: 'g', ml: 'ml', unita: 'pezzi' } as const;

function ModificaConfezione({
  c,
  ingrediente,
  attesa,
  fai,
}: {
  c: Confezione;
  ingrediente: Ingrediente;
  attesa: boolean;
  fai: (azione: () => Promise<void>) => void;
}) {
  const [quantita, setQuantita] = useState(c.quantita === null ? '' : String(c.quantita).replace('.', ','));
  const [scadenza, setScadenza] = useState(c.scadenza ? formattaData(c.scadenza) : '');
  const [posizione, setPosizione] = useState<Posizione>(c.posizione);
  const [stato, setStato] = useState<StatoScorta>(c.stato ?? 'presente');
  const q = leggiNumero(quantita);
  const data = leggiData(scadenza);
  const aStato = c.quantita === null;
  const valido = (aStato || (q !== null && q > 0)) && data !== 'errore';

  const salva = (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    fai(() => modificaConfezione(c.id, { ...(aStato ? { stato } : { quantita: q }), scadenza: data as string | null, posizione }));
  };

  return (
    <form className="modifica-confezione" onSubmit={salva}>
      <div className="due-campi">
        {aStato ? (
          <div>
            <label htmlFor={`s-${c.id}`}>Quanto ne resta</label>
            <select id={`s-${c.id}`} value={stato} onChange={(e) => setStato(e.target.value as StatoScorta)}>
              <option value="presente">Ce n’è</option>
              <option value="sta_finendo">Sta finendo</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor={`q-${c.id}`}>Quantità</label>
            <span className="campo-unita largo">
              <input id={`q-${c.id}`} inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
              <span>{UNITA[ingrediente.unita_base]}</span>
            </span>
          </div>
        )}
        <div>
          <label htmlFor={`d-${c.id}`}>Scadenza</label>
          <input
            id={`d-${c.id}`}
            inputMode="numeric"
            placeholder="gg/mm/aaaa"
            autoComplete="off"
            aria-invalid={data === 'errore'}
            value={scadenza}
            onChange={(e) => setScadenza(mascheraData(e.target.value))}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`p-${c.id}`}>Dove si trova</label>
        <select id={`p-${c.id}`} value={posizione} onChange={(e) => setPosizione(e.target.value as Posizione)}>
          {POSIZIONI.map((p) => (
            <option key={p.valore} value={p.valore}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="comandi">
        <button type="submit" disabled={attesa || !valido}>
          Salva
        </button>
        <button type="button" className="contorno" disabled={attesa} onClick={() => fai(() => chiudiConfezione(c.id, 'uso'))}>
          È finita
        </button>
        <button type="button" className="contorno rosso" disabled={attesa} onClick={() => fai(() => chiudiConfezione(c.id, 'buttato'))}>
          L’ho buttata
        </button>
      </div>
    </form>
  );
}

/** "Ne ho usato…": scala una quantità dall'ingrediente senza passare da una ricetta, partendo da ciò che scade prima. */
function UsoRapido({ ingrediente, attesa, usa }: { ingrediente: Ingrediente; attesa: boolean; usa: (quantita: number) => void }) {
  const [testo, setTesto] = useState('');
  const q = leggiNumero(testo);
  return (
    <form
      className="uso-rapido"
      onSubmit={(e) => {
        e.preventDefault();
        if (q) usa(q);
      }}
    >
      <label htmlFor={`uso-${ingrediente.id}`}>Ne ho usato</label>
      <span className="campo-unita">
        <input id={`uso-${ingrediente.id}`} inputMode="decimal" value={testo} onChange={(e) => setTesto(e.target.value)} />
        <span>{UNITA[ingrediente.unita_base]}</span>
      </span>
      <button type="submit" className="contorno" disabled={attesa || !q}>
        Scala
      </button>
    </form>
  );
}

export default function Dispensa({ dati, casa, ricarica }: { dati: Dati; casa: Casa; ricarica: () => Promise<void> }) {
  const lista = usaLista(casa.id);
  const [confezioni, setConfezioni] = useState<Confezione[] | null>(() => leggiCache<Confezione[]>('dispensa'));
  const [errore, setErrore] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Posizione | 'tutto'>('tutto');
  const [aperto, setAperto] = useState<string | null>(null);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [aggiunta, setAggiunta] = useState<'scanner' | 'cerca' | null>(null);
  const [messo, setMesso] = useState<string | null>(null);

  const catalogo = useMemo(() => new Map(dati.ingredienti.map((i) => [i.id, i])), [dati.ingredienti]);

  const carica = useCallback(async () => {
    try {
      const righe = await leggiDispensa(casa.id);
      setConfezioni(righe);
      setErrore(null);
      scriviCache('dispensa', righe);
    } catch {
      setErrore('Senza connessione: vedi l’ultima versione salvata e non puoi modificare la dispensa.');
    }
  }, [casa.id]);

  useEffect(() => {
    void carica();
  }, [carica]);

  function fai(azione: () => Promise<void>) {
    setAttesa(true);
    azione()
      .then(carica)
      .then(() => setInModifica(null))
      .catch((e: Error) => setErrore(`Modifica non salvata: ${e.message}`))
      .finally(() => setAttesa(false));
  }

  // una riga per ingrediente, con dentro le sue confezioni dalla scadenza più vicina
  const righe = useMemo(() => {
    const gruppi = new Map<string, Confezione[]>();
    for (const c of confezioni ?? []) {
      if (filtro !== 'tutto' && c.posizione !== filtro) continue;
      gruppi.set(c.ingrediente_id, [...(gruppi.get(c.ingrediente_id) ?? []), c]);
    }
    const lontano = '9999-12-31';
    return [...gruppi]
      .map(([id, sue]) => {
        sue.sort((a, b) => (a.scadenza ?? lontano).localeCompare(b.scadenza ?? lontano));
        const ingrediente = catalogo.get(id);
        return { id, ingrediente, sue, prima: sue[0].scadenza, nome: ingrediente?.nome ?? 'ingrediente non più in catalogo' };
      })
      .sort((a, b) => (a.prima ?? lontano).localeCompare(b.prima ?? lontano) || a.nome.localeCompare(b.nome, 'it'));
  }, [confezioni, filtro, catalogo]);

  // per ciò che scade: le ricette che lo usano, dalla più fattibile con quello che c'è in casa
  const ricettePerIngrediente = useMemo(() => {
    const ordinate = consiglia(dati.ricette, confezioni ?? [], [], null, {
      pasto: null,
      minuti: null,
      tag: [],
      testo: '',
      persone: casa.porzioni_predefinite,
      obiettivi: false,
      dispensa: true,
      scadenze: true,
    });
    return (id: string) => ordinate.filter((c) => c.ricetta.ingredienti.some((i) => i.ingrediente_id === id && !i.facoltativo)).slice(0, 3);
  }, [dati.ricette, confezioni, casa.porzioni_predefinite]);

  if (aggiunta) {
    return (
      <AggiungiADispensa
        dati={dati}
        casa={casa}
        daScanner={aggiunta === 'scanner'}
        ricarica={ricarica}
        chiudi={(aggiunto) => {
          setAggiunta(null);
          if (aggiunto) void carica();
        }}
      />
    );
  }

  const daComprare = lista.visibili.filter((v) => !v.spuntata).length;
  const inLista = new Set(lista.visibili.filter((v) => !v.spuntata).map((v) => v.ingrediente_id));
  const urgenti = righe.filter((r) => r.prima && descriviScadenza(r.prima).urgenza !== 'lontano').length;
  const vuota = (confezioni ?? []).length === 0;

  return (
    <main className="dispensa">
      <header className="home-testa">
        <h1>Dispensa</h1>
      </header>
      <SchedeDispensa attiva="dispensa" daComprare={daComprare} />

      <div className="azioni-dispensa">
        <button onClick={() => setAggiunta('scanner')}>
          <IconaCodice />
          Scansiona
        </button>
        <button className="contorno" onClick={() => setAggiunta('cerca')}>
          Aggiungi a mano
        </button>
      </div>

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {confezioni === null ? (
        !errore && <p className="nota">Carico la dispensa…</p>
      ) : vuota ? (
        <section className="vuoto piccolo">
          <h2>La dispensa è vuota</h2>
          <p>
            Dopo la spesa, dalla lista premi «Fine spesa» per mettere via quello che hai comprato. Per le cose che hai già in casa usa i pulsanti
            qui sopra.
          </p>
        </section>
      ) : (
        <>
          <div className="filtri" role="group" aria-label="Dove si trova">
            {([{ valore: 'tutto', nome: 'Tutto' }, ...POSIZIONI] as { valore: Posizione | 'tutto'; nome: string }[]).map((p) => (
              <button key={p.valore} className="filtro" aria-pressed={filtro === p.valore} onClick={() => setFiltro(p.valore)}>
                {p.nome}
              </button>
            ))}
          </div>
          <p className="conteggio">
            {righe.length === 1 ? '1 ingrediente' : `${righe.length} ingredienti`}
            {urgenti > 0 && `, ${urgenti} da consumare presto`}
          </p>

          <ul className="scorte">
            {righe.map((r) => {
              const totale = r.sue.reduce((t, c) => t + (c.quantita ?? 0), 0);
              const aStato = r.sue.every((c) => c.quantita === null);
              const scadenza = r.prima ? descriviScadenza(r.prima) : null;
              const staFinendo = aStato && r.sue.every((c) => c.stato === 'sta_finendo');
              return (
                <li key={r.id}>
                  <button className="scorta" aria-expanded={aperto === r.id} onClick={() => setAperto(aperto === r.id ? null : r.id)}>
                    <span className="icona" aria-hidden="true">
                      {r.ingrediente?.icona}
                    </span>
                    <span className="testi">
                      <span className="titolo">{maiuscola(r.nome)}</span>
                      <span className="dettagli" data-urgenza={scadenza?.urgenza}>
                        {scadenza?.testo ?? 'senza scadenza'}
                        {r.sue.length > 1 && `, ${r.sue.length} confezioni`}
                      </span>
                    </span>
                    <span className="quanto">
                      {aStato ? (staFinendo ? 'sta finendo' : 'c’è') : formattaQuantita(totale, r.ingrediente?.unita_base ?? null, 1, false)}
                    </span>
                  </button>

                  {aperto === r.id && (
                    <div className="confezioni">
                      {r.sue.map((c) => {
                        const sc = c.scadenza ? descriviScadenza(c.scadenza) : null;
                        return (
                          <div key={c.id} className="una-confezione">
                            <button className="riga-confezione" aria-expanded={inModifica === c.id} onClick={() => setInModifica(inModifica === c.id ? null : c.id)}>
                              <span className="testi">
                                <span className="titolo">
                                  {c.quantita !== null
                                    ? formattaQuantita(c.quantita, r.ingrediente?.unita_base ?? null, 1, false)
                                    : c.stato === 'sta_finendo'
                                      ? 'Sta finendo'
                                      : 'Ce n’è'}
                                  {c.prodotti?.nome && <span className="prodotto">, {c.prodotti.nome}</span>}
                                </span>
                                <span className="dettagli" data-urgenza={sc?.urgenza}>
                                  {POSIZIONI.find((p) => p.valore === c.posizione)!.nome}, {sc?.testo ?? 'senza scadenza'}
                                </span>
                              </span>
                              <span className="modifica-etichetta">Modifica</span>
                            </button>
                            {inModifica === c.id && r.ingrediente && <ModificaConfezione c={c} ingrediente={r.ingrediente} attesa={attesa} fai={fai} />}
                          </div>
                        );
                      })}
                      {r.ingrediente && !aStato && (
                        <UsoRapido
                          key={totale}
                          ingrediente={r.ingrediente}
                          attesa={attesa}
                          usa={(quantita) => fai(() => scalaDispensa(casa.id, null, [{ ingrediente_id: r.id, quantita }]))}
                        />
                      )}
                      {scadenza && scadenza.urgenza !== 'lontano' && ricettePerIngrediente(r.id).length > 0 && (
                        <div className="da-usare">
                          <h3>Ricette per usarlo</h3>
                          <ul>
                            {ricettePerIngrediente(r.id).map((c) => (
                              <li key={c.ricetta.id}>
                                <button className="secondario" onClick={() => vai(`/ricetta/${c.ricetta.id}`)}>
                                  <span className="titolo">{c.ricetta.titolo}</span>
                                  <span className="dettagli">
                                    {c.mancanti.length === 0 ? 'hai tutto in casa' : c.mancanti.length === 1 ? `manca ${c.mancanti[0].nome}` : `mancano ${c.mancanti.length} ingredienti`}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.ingrediente &&
                        (inLista.has(r.id) || messo === r.id ? (
                          <p className="nota">È nella lista della spesa.</p>
                        ) : (
                          <button
                            className="secondario in-lista"
                            onClick={() => {
                              aggiungi(null, r.id);
                              setMesso(r.id);
                            }}
                          >
                            Metti nella lista della spesa
                          </button>
                        ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
