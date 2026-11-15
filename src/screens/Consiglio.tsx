import { useEffect, useMemo, useState } from 'react';
import { formattaMinuti, type Casa, type Dati } from '../lib/dati';
import { consiglia, obiettivoDelPasto, type Consiglio as Proposta, type Richieste } from '../lib/consiglio';
import { oggi, piuGiorni } from '../lib/date';
import {
  OBIETTIVI_VUOTI,
  aggiungiVoce,
  haObiettivo,
  leggiDiario,
  leggiObiettivi,
  nomeQuantita,
  obiettivoDel,
  pastoDiarioDiAdesso,
  somma,
  type Obiettivi,
  type VoceDiario,
} from '../lib/diario';
import { leggiDispensa, type Confezione } from '../lib/dispensa';
import { aggiungi, usaLista } from '../lib/lista';
import { PASTI, type Pasto } from '../lib/piano';
import { tornaAlDiario, vai } from '../lib/rotta';
import { Miniatura } from './Copertina';
import { avviaCucina } from './Cucina';
import { Sintesi } from './ValoriDiario';

const TEMPI: { minuti: number | null; nome: string }[] = [
  { minuti: null, nome: 'Qualsiasi tempo' },
  { minuti: 15, nome: '15 min' },
  { minuti: 30, nome: '30 min' },
  { minuti: 45, nome: '45 min' },
];
const A_GRUPPI = 4;

/** Consiglia un singolo pasto in base alle richieste del momento e a quello che c'è in dispensa. */
export default function Consiglio({ dati, casa }: { dati: Dati; casa: Casa }) {
  // tiene attiva la lista della spesa, per poterci mettere quello che manca
  const lista = usaLista(casa.id);
  const [confezioni, setConfezioni] = useState<Confezione[] | null>(null);
  const [diario, setDiario] = useState<VoceDiario[]>([]);
  const [obiettivi, setObiettivi] = useState<Obiettivi>(OBIETTIVI_VUOTI);
  const [senzaRete, setSenzaRete] = useState(false);
  const [richieste, setRichieste] = useState<Richieste>(() => ({
    pasto: pastoDiarioDiAdesso(),
    minuti: null,
    tag: [],
    testo: '',
    persone: casa.porzioni_predefinite,
    obiettivi: true,
    dispensa: true,
    scadenze: false,
  }));
  const [quante, setQuante] = useState(A_GRUPPI);
  const [fatte, setFatte] = useState<Record<string, 'diario' | 'lista' | 'entrambe'>>({});
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const giorno = oggi();
    Promise.all([leggiDispensa(casa.id), leggiDiario(piuGiorni(giorno, -3), giorno), leggiObiettivi()]).then(
      ([d, voci, mete]) => {
        setConfezioni(d);
        setDiario(voci);
        setObiettivi(mete);
      },
      () => {
        setConfezioni([]);
        setSenzaRete(true);
      },
    );
  }, [casa.id]);

  const giorno = oggi();
  const obiettivoOggi = obiettivoDel(obiettivi, giorno);
  const conObiettivi = haObiettivo(obiettivoOggi);
  const meta = useMemo(
    () => (conObiettivi ? obiettivoDelPasto(obiettivoOggi, somma(diario.filter((v) => v.data === giorno)), richieste.pasto ?? 'pranzo') : null),
    // obiettivoOggi è ricalcolato a ogni giro: dipende da obiettivi e giorno
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obiettivi, diario, giorno, richieste.pasto, conObiettivi],
  );
  const proposte = useMemo(
    () => (confezioni ? consiglia(dati.ricette, confezioni, diario, meta, richieste) : []),
    [dati.ricette, confezioni, diario, meta, richieste],
  );

  // si propongono solo i tag che almeno una ricetta ha
  const tagUsati = useMemo(() => dati.tag.filter((t) => !t.automatico && dati.ricette.some((r) => r.tag.some((x) => x.id === t.id))), [dati]);
  const cambia = (campi: Partial<Richieste>) => {
    setRichieste((r) => ({ ...r, ...campi }));
    setQuante(A_GRUPPI);
  };
  const pasto = richieste.pasto ?? 'pranzo';
  const nomePasto = PASTI.find((p) => p.valore === pasto)!.nome.toLowerCase();
  const segna = (id: string, cosa: 'diario' | 'lista') =>
    setFatte((f) => ({ ...f, [id]: f[id] && f[id] !== cosa ? 'entrambe' : cosa }));

  async function nelDiario(p: Proposta) {
    setErrore(null);
    try {
      await aggiungiVoce({
        data: giorno,
        pasto,
        nome: p.ricetta.titolo,
        ricetta_id: p.ricetta.id,
        ingrediente_id: null,
        piano_id: null,
        quantita: p.porzioni,
        unita: 'porzioni',
        ...p.valori,
      });
      segna(p.ricetta.id, 'diario');
    } catch (e) {
      setErrore(`Non aggiunta al diario: ${(e as Error).message}. Controlla la connessione e riprova.`);
    }
  }

  function inLista(p: Proposta) {
    const giaInLista = new Set(lista.visibili.filter((v) => !v.spuntata).map((v) => v.ingrediente_id));
    for (const m of p.mancanti) if (!giaInLista.has(m.ingrediente_id)) aggiungi(null, m.ingrediente_id);
    segna(p.ricetta.id, 'lista');
  }

  return (
    <main className="consiglio">
      <button className="indietro secondario" onClick={tornaAlDiario}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Indietro
      </button>
      <header className="ricetta-testa">
        <h1>Cosa mangio?</h1>
      </header>

      <section className="richieste" aria-label="Richieste del momento">
        <div className="due-campi">
          <div>
            <label htmlFor="c-pasto">Pasto</label>
            <select id="c-pasto" value={pasto} onChange={(e) => cambia({ pasto: e.target.value as Pasto })}>
              {PASTI.map((p) => (
                <option key={p.valore} value={p.valore}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="c-persone">Per quante persone</label>
            <select id="c-persone" value={richieste.persone} onChange={(e) => cambia({ persone: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="c-testo">Ho voglia di</label>
          <input id="c-testo" type="search" placeholder="pollo, uova, riso…" value={richieste.testo} onChange={(e) => cambia({ testo: e.target.value })} />
        </div>

        <div className="filtri" role="group" aria-label="Tempo a disposizione">
          {TEMPI.map((t) => (
            <button key={t.nome} className="filtro" aria-pressed={richieste.minuti === t.minuti} onClick={() => cambia({ minuti: t.minuti })}>
              {t.nome}
            </button>
          ))}
        </div>
        <div className="filtri" role="group" aria-label="Tipo di piatto">
          {tagUsati.map((t) => {
            const scelto = richieste.tag.includes(t.id);
            return (
              <button key={t.id} className="filtro" aria-pressed={scelto} onClick={() => cambia({ tag: scelto ? richieste.tag.filter((x) => x !== t.id) : [...richieste.tag, t.id] })}>
                {t.nome}
              </button>
            );
          })}
        </div>

        <div className="scelte">
          <label className="spunta">
            <input type="checkbox" checked={richieste.dispensa} onChange={(e) => cambia({ dispensa: e.target.checked })} />
            Preferisci quello che posso fare con ciò che ho in casa
          </label>
          <label className="spunta">
            <input type="checkbox" checked={richieste.scadenze} onChange={(e) => cambia({ scadenze: e.target.checked })} />
            Fammi usare quello che sta per scadere
          </label>
          <label className="spunta">
            <input type="checkbox" checked={richieste.obiettivi && conObiettivi} disabled={!conObiettivi} onChange={(e) => cambia({ obiettivi: e.target.checked })} />
            Resta nei miei obiettivi di oggi
          </label>
        </div>
        {!conObiettivi && confezioni && <p className="nota">Per oggi non hai un obiettivo: lo imposti dal Diario, in «Obiettivi».</p>}
        {meta && richieste.obiettivi && (
          <p className="nota">
            Per {nomePasto} ti restano circa <Sintesi valori={{ kcal: meta.kcal === null ? null : Math.round(meta.kcal), proteine_g: meta.proteine_g === null ? null : Math.round(meta.proteine_g), carboidrati_g: null, grassi_g: null }} />.
          </p>
        )}
      </section>

      {senzaRete && <p className="stato-rete">Senza connessione non vedo dispensa e diario: i consigli si basano solo sulle tue richieste.</p>}
      {confezioni?.length === 0 && !senzaRete && (
        <p className="stato-rete">La dispensa è vuota: per ora non posso tener conto di quello che hai in casa.</p>
      )}
      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {confezioni === null ? (
        <p className="nota">Guardo cosa c’è in casa…</p>
      ) : proposte.length === 0 ? (
        <section className="vuoto piccolo">
          <h2>Nessuna ricetta adatta</h2>
          <p>Con queste richieste non trovo niente. Togli un filtro o allarga il tempo.</p>
        </section>
      ) : (
        <>
          <ol className="proposte">
            {proposte.slice(0, quante).map((p) => (
              <li key={p.ricetta.id} className="proposta-pasto">
                <button className="apri-ricetta" onClick={() => vai(`/ricetta/${p.ricetta.id}`)}>
                  <Miniatura ricetta={p.ricetta} />
                  <span className="testi">
                    <span className="titolo">{p.ricetta.titolo}</span>
                    <span className="dettagli">
                      {p.ricetta.minuti_totali !== null && <>{formattaMinuti(p.ricetta.minuti_totali)}, </>}
                      {nomeQuantita(p.porzioni, 'porzioni')}: <Sintesi valori={p.valori} />
                    </span>
                  </span>
                </button>
                {p.motivi.length > 0 && (
                  <ul className="motivi">
                    {p.motivi.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
                <div className="comandi">
                  <button
                    onClick={() => {
                      avviaCucina(p.ricetta.id, Math.max(1, Math.round(p.porzioni * richieste.persone)));
                      vai(`/cucina/${p.ricetta.id}`);
                    }}
                  >
                    Cucina
                  </button>
                  {fatte[p.ricetta.id] === 'diario' || fatte[p.ricetta.id] === 'entrambe' ? (
                    <span className="fatto-nota" role="status">
                      Nel diario, {nomePasto}
                    </span>
                  ) : (
                    <button className="contorno" onClick={() => void nelDiario(p)}>
                      Aggiungi al diario
                    </button>
                  )}
                  {p.mancanti.length > 0 &&
                    (fatte[p.ricetta.id] === 'lista' || fatte[p.ricetta.id] === 'entrambe' ? (
                      <span className="fatto-nota" role="status">
                        Messo in lista
                      </span>
                    ) : (
                      <button className="contorno" onClick={() => inLista(p)}>
                        Metti in lista quello che manca
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ol>
          {proposte.length > quante && (
            <button className="contorno altre" onClick={() => setQuante(quante + A_GRUPPI)}>
              Altre proposte
            </button>
          )}
        </>
      )}
    </main>
  );
}
