import { useEffect, useState, type ReactNode } from 'react';
import type { Casa, Dati } from '../lib/dati';
import { PASTI, type Pasto } from '../lib/piano';
import {
  GRUPPI,
  leggiPreferenzeCasa,
  leggiPreferenzePersone,
  salvaPreferenzeCasa,
  salvaPreferenzePersona,
  type Limite,
  type PreferenzeCasa,
  type PreferenzePersona,
  type QuandoPasto,
} from '../lib/preferenze';
import { vai } from '../lib/rotta';

const QUANDO: { valore: QuandoPasto; nome: string }[] = [
  { valore: 'sempre', nome: 'Tutti i giorni' },
  { valore: 'feriali', nome: 'Solo dal lunedì al venerdì' },
  { valore: 'weekend', nome: 'Solo sabato e domenica' },
  { valore: 'mai', nome: 'Mai' },
];
const TEMPI: (number | null)[] = [null, 20, 30, 45, 60];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Chiave messa dal Menù quando manda qui per la prima volta: dopo il salvataggio la settimana viene proposta subito. */
export const PROPONI_DOPO = 'ricettario.proponi-dopo';

/**
 * Preferenze per comporre il menù. La prima volta è un questionario, una domanda per schermata;
 * dopo, tutte le domande sono in una pagina sola. Ogni risposta è facoltativa.
 */
export default function Preferenze({ dati, casa, utente }: { dati: Dati; casa: Casa; utente: string }) {
  const [dellaCasa, setDellaCasa] = useState<PreferenzeCasa | null>(null);
  const [mie, setMie] = useState<PreferenzePersona>({});
  const [questionario, setQuestionario] = useState(false);
  const [passo, setPasso] = useState(0);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([leggiPreferenzeCasa(casa.id), leggiPreferenzePersone(casa.id)]).then(
      ([c, p]) => {
        setDellaCasa(c);
        setMie(p[utente] ?? {});
        setQuestionario(!c.compilate);
      },
      () => setErrore('Senza connessione non posso leggere le preferenze. Riprova più tardi.'),
    );
  }, [casa.id, utente]);

  if (!dellaCasa) {
    return (
      <main className="preferenze">
        <Indietro />
        {errore ? (
          <p role="alert" className="errore">
            {errore}
          </p>
        ) : (
          <p className="nota">Carico le preferenze…</p>
        )}
      </main>
    );
  }

  const c = dellaCasa;
  const cambiaCasa = (campi: Partial<PreferenzeCasa>) => setDellaCasa({ ...c, ...campi });
  const cambiaMie = (campi: Partial<PreferenzePersona>) => setMie({ ...mie, ...campi });
  const limiti = mie.limiti ?? [];
  const cambiaLimite = (n: number, campi: Partial<Limite>) => cambiaMie({ limiti: limiti.map((l, k) => (k === n ? { ...l, ...campi } : l)) });
  const tagScelti = dati.tag.filter((t) => !t.automatico);
  const alterna = (elenco: string[] | undefined, id: string) => ((elenco ?? []).includes(id) ? (elenco ?? []).filter((x) => x !== id) : [...(elenco ?? []), id]);
  const ingredientiLimitabili = dati.ingredienti.filter((i) => !i.base).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  const domande: { titolo: string; di: 'casa' | 'tu'; aiuto?: string; corpo: ReactNode }[] = [
    {
      titolo: 'Quali pasti vuoi che pianifichi?',
      di: 'casa',
      aiuto: 'Pranzo e cena sono pasti comuni. Colazione e merende vengono proposte a ciascuno in base ai suoi obiettivi.',
      corpo: (
        <div className="elenco-campi">
          {PASTI.map((p) => (
            <div key={p.valore} className="campo-riga">
              <label htmlFor={`quando-${p.valore}`}>{p.nome}</label>
              <select
                id={`quando-${p.valore}`}
                value={c.pasti?.[p.valore] ?? 'sempre'}
                onChange={(e) => cambiaCasa({ pasti: { ...c.pasti, [p.valore]: e.target.value as QuandoPasto } as Partial<Record<Pasto, QuandoPasto>> })}
              >
                {QUANDO.map((q) => (
                  <option key={q.valore} value={q.valore}>
                    {q.nome}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ),
    },
    {
      titolo: 'Per quante persone cucini di solito?',
      di: 'casa',
      corpo: (
        <div className="filtri a-capo" role="group" aria-label="Persone">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className="filtro" aria-pressed={(c.persone ?? casa.porzioni_predefinite) === n} onClick={() => cambiaCasa({ persone: n })}>
              {n}
            </button>
          ))}
        </div>
      ),
    },
    {
      titolo: 'Quanto tempo hai per cucinare?',
      di: 'casa',
      corpo: (
        <>
          {(
            [
              ['minuti_feriali', 'Dal lunedì al venerdì'],
              ['minuti_weekend', 'Sabato e domenica'],
            ] as const
          ).map(([campo, nome]) => (
            <div key={campo} className="gruppo-scelte">
              <p className="etichetta">{nome}</p>
              <div className="filtri a-capo" role="group" aria-label={nome}>
                {TEMPI.map((t) => (
                  <button key={String(t)} type="button" className="filtro" aria-pressed={(c[campo] ?? null) === t} onClick={() => cambiaCasa({ [campo]: t })}>
                    {t === null ? 'Non importa' : `${t} min`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ),
    },
    {
      titolo: 'Che piatti preferisci?',
      di: 'tu',
      aiuto: 'Quello che eviti non viene proposto nemmeno nei pasti comuni.',
      corpo: (
        <>
          <div className="gruppo-scelte">
            <p className="etichetta">Mi piacciono</p>
            <div className="filtri a-capo" role="group" aria-label="Mi piacciono">
              {tagScelti.map((t) => (
                <button key={t.id} type="button" className="filtro" aria-pressed={(mie.tag_si ?? []).includes(t.id)} onClick={() => cambiaMie({ tag_si: alterna(mie.tag_si, t.id), tag_no: (mie.tag_no ?? []).filter((x) => x !== t.id) })}>
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="gruppo-scelte">
            <p className="etichetta">Da evitare</p>
            <div className="filtri a-capo" role="group" aria-label="Da evitare">
              {tagScelti.map((t) => (
                <button key={t.id} type="button" className="filtro" aria-pressed={(mie.tag_no ?? []).includes(t.id)} onClick={() => cambiaMie({ tag_no: alterna(mie.tag_no, t.id), tag_si: (mie.tag_si ?? []).filter((x) => x !== t.id) })}>
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
        </>
      ),
    },
    {
      titolo: 'Vuoi limitare qualche ingrediente?',
      di: 'tu',
      aiuto: 'Per esempio carne rossa al massimo 2 volte a settimana. Zero volte significa mai. Senza limiti non cambia nulla.',
      corpo: (
        <div className="limiti">
          {limiti.map((l, n) => (
            <div key={n} className="limite">
              <select
                aria-label="Ingrediente o gruppo"
                value={`${l.tipo}:${l.id}`}
                onChange={(e) => {
                  const [tipo, id] = e.target.value.split(':');
                  cambiaLimite(n, { tipo: tipo as Limite['tipo'], id });
                }}
              >
                <optgroup label="Gruppi">
                  {GRUPPI.map((g) => (
                    <option key={g.id} value={`gruppo:${g.id}`}>
                      {g.nome}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ingredienti">
                  {ingredientiLimitabili.map((i) => (
                    <option key={i.id} value={`ingrediente:${i.id}`}>
                      {maiuscola(i.nome)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <select aria-label="Quante volte a settimana al massimo" value={l.max} onChange={(e) => cambiaLimite(n, { max: Number(e.target.value) })}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'mai' : v === 1 ? 'al massimo 1 volta' : `al massimo ${v} volte`}
                  </option>
                ))}
              </select>
              <button type="button" className="secondario" aria-label="Togli questo limite" onClick={() => cambiaMie({ limiti: limiti.filter((_, k) => k !== n) })}>
                Togli
              </button>
            </div>
          ))}
          <button type="button" className="contorno" onClick={() => cambiaMie({ limiti: [...limiti, { tipo: 'gruppo', id: 'carne_rossa', max: 2 }] })}>
            Aggiungi un limite
          </button>
        </div>
      ),
    },
    {
      titolo: 'Quanta varietà vuoi?',
      di: 'casa',
      corpo: (
        <>
          <div className="gruppo-scelte">
            <p className="etichetta">La stessa ricetta in una settimana</p>
            <div className="filtri a-capo" role="group" aria-label="Ripetizioni">
              {([1, 2, 3, null] as (number | null)[]).map((n) => (
                <button key={String(n)} type="button" className="filtro" aria-pressed={(c.max_ripetizioni === undefined ? 1 : c.max_ripetizioni) === n} onClick={() => cambiaCasa({ max_ripetizioni: n })}>
                  {n === null ? 'Non importa' : n === 1 ? 'Una volta sola' : `Fino a ${n} volte`}
                </button>
              ))}
            </div>
          </div>
          <label className="spunta">
            <input type="checkbox" checked={!!c.avanzi} onChange={(e) => cambiaCasa({ avanzi: e.target.checked })} />
            Cucino una volta per due pasti: la cena diventa il pranzo del giorno dopo
          </label>
        </>
      ),
    },
    {
      titolo: 'Quanti sgarri a settimana?',
      di: 'casa',
      aiuto: 'Uno sgarro è una cena comune più sfiziosa, scelta senza guardare gli obiettivi.',
      corpo: (
        <>
          <div className="filtri a-capo" role="group" aria-label="Sgarri a settimana">
            {[0, 1, 2, 3].map((n) => (
              <button key={n} type="button" className="filtro" aria-pressed={(c.sgarri ?? 0) === n} onClick={() => cambiaCasa({ sgarri: n })}>
                {n === 0 ? 'Nessuno' : n}
              </button>
            ))}
          </div>
          {(c.sgarri ?? 0) > 0 && (
            <div className="gruppo-scelte">
              <p className="etichetta">In quali giorni (se non scegli, decide l’app)</p>
              <div className="filtri a-capo" role="group" aria-label="Giorni di sgarro">
                {GIORNI.map((g, n) => (
                  <button
                    key={g}
                    type="button"
                    className="filtro"
                    aria-pressed={(c.giorni_sgarro ?? []).includes(n + 1)}
                    onClick={() => cambiaCasa({ giorni_sgarro: (c.giorni_sgarro ?? []).includes(n + 1) ? (c.giorni_sgarro ?? []).filter((x) => x !== n + 1) : [...(c.giorni_sgarro ?? []), n + 1] })}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      titolo: 'Di cosa devo tenere conto?',
      di: 'tu',
      corpo: (
        <>
          <label className="spunta">
            <input type="checkbox" checked={mie.obiettivi !== false} onChange={(e) => cambiaMie({ obiettivi: e.target.checked })} />
            I miei obiettivi di calorie e macronutrienti, anche con porzioni non intere
          </label>
          <label className="spunta">
            <input type="checkbox" checked={c.dispensa !== false} onChange={(e) => cambiaCasa({ dispensa: e.target.checked })} />
            Quello che c’è in dispensa e ciò che sta per scadere (vale per tutta la casa)
          </label>
        </>
      ),
    },
  ];

  async function salva() {
    setAttesa(true);
    setErrore(null);
    try {
      await Promise.all([salvaPreferenzeCasa(casa.id, { ...c, compilate: true }), salvaPreferenzePersona(casa.id, utente, mie)]);
      vai('/menu');
    } catch (e) {
      setErrore(`Preferenze non salvate: ${(e as Error).message}. Controlla la connessione e riprova.`);
      setAttesa(false);
    }
  }

  const blocco = (d: (typeof domande)[number], n: number) => (
    <section key={d.titolo} className="domanda" aria-labelledby={`domanda-${n}`}>
      <h2 id={`domanda-${n}`}>{d.titolo}</h2>
      <p className="di-chi">{d.di === 'casa' ? 'Vale per tutta la casa' : 'Vale solo per te'}</p>
      {d.aiuto && <p className="nota">{d.aiuto}</p>}
      {d.corpo}
    </section>
  );
  const ultimo = passo === domande.length - 1;

  return (
    <main className="preferenze">
      <Indietro />
      <header className="ricetta-testa">
        <h1>Preferenze del menù</h1>
        <p className="origine">
          {questionario ? `Domanda ${passo + 1} di ${domande.length}. Puoi saltare quelle che non ti interessano.` : 'Servono a «Proponi settimana». Sono tutte facoltative.'}
        </p>
      </header>

      {questionario ? blocco(domande[passo], passo) : domande.map(blocco)}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {questionario ? (
        <div className="passi">
          {ultimo ? (
            <button disabled={attesa} onClick={salva}>
              {attesa ? 'Salvataggio…' : sessionStorage.getItem(PROPONI_DOPO) ? 'Salva e proponi la settimana' : 'Salva le preferenze'}
            </button>
          ) : (
            <button
              onClick={() => {
                setPasso(passo + 1);
                window.scrollTo(0, 0);
              }}
            >
              Avanti
            </button>
          )}
          <div className="passi-secondari">
            {passo > 0 && (
              <button className="secondario" onClick={() => setPasso(passo - 1)}>
                Domanda precedente
              </button>
            )}
            {!ultimo && (
              <button className="secondario" onClick={() => setPasso(domande.length - 1)}>
                Salta il resto
              </button>
            )}
          </div>
        </div>
      ) : (
        <button className="salva-preferenze" disabled={attesa} onClick={salva}>
          {attesa ? 'Salvataggio…' : 'Salva le preferenze'}
        </button>
      )}
    </main>
  );
}

function Indietro() {
  return (
    <button
      className="indietro secondario"
      onClick={() => {
        sessionStorage.removeItem(PROPONI_DOPO);
        vai('/menu');
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Menù
    </button>
  );
}
