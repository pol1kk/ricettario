import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { formattaMinuti, formattaValore, leggiCache, scriviCache, semplifica, type Casa, type Dati, type Ricetta } from '../lib/dati';
import { lunedi, nomeGiorno, nomeSettimana, oggi, piuGiorni } from '../lib/date';
import { leggiDispensa } from '../lib/dispensa';
import { leggiObiettiviCasa, leggiPreferenzeCasa, leggiPreferenzePersone } from '../lib/preferenze';
import { alternativaPerMe, alternative, lontanoDagliObiettivi, proponiSettimana, type Contesto } from '../lib/proposta';
import { PROPONI_DOPO } from './Preferenze';
import {
  PASTI,
  aggiungiAlPiano,
  aggiungiVoci,
  annullaProposta,
  tieniProposta,
  leggiPersone,
  leggiPiano,
  modificaPiano,
  nomePorzioni,
  togliDalPiano,
  type Pasto,
  type VocePiano,
} from '../lib/piano';
import { vai, vaiAScheda } from '../lib/rotta';
import { Miniatura } from './Copertina';
import Porzioni from './Porzioni';

type Props = { dati: Dati; casa: Casa; utente: string; settimana: string; setSettimana: (s: string) => void };

const eMerenda = (p: Pasto) => p === 'merenda_mattino' || p === 'merenda_pomeriggio';

function ScegliPasto({
  dati,
  casa,
  utente,
  data,
  pasto,
  soloPerMe,
  chiudi,
}: {
  dati: Dati;
  casa: Casa;
  utente: string;
  data: string;
  pasto: Pasto;
  /** come parte la scelta "per chi": le merende di solito sono personali, i pasti principali comuni */
  soloPerMe: boolean;
  chiudi: (aggiunto: boolean) => void;
}) {
  const [testo, setTesto] = useState('');
  const [nota, setNota] = useState('');
  const [perMe, setPerMe] = useState(soloPerMe);
  const [porzioni, setPorzioni] = useState(soloPerMe ? 1 : casa.porzioni_predefinite);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const { nome: nomePasto, tag: tagPasto } = PASTI.find((p) => p.valore === pasto)!;

  const ricette = useMemo(() => {
    const parole = semplifica(testo).split(/\s+/).filter(Boolean);
    // prima le ricette con il tag adatto al pasto ("colazione", oppure "snack" per le merende)
    const adatta = (r: Ricetta) => (r.tag.some((t) => t.nome === tagPasto) ? 0 : 1);
    return dati.ricette.filter((r) => parole.every((p) => r.cerca.includes(p))).sort((a, b) => adatta(a) - adatta(b));
  }, [dati.ricette, testo, tagPasto]);

  async function aggiungi(voce: { ricetta_id?: string; nota?: string }) {
    setAttesa(true);
    setErrore(null);
    try {
      await aggiungiAlPiano(casa.id, { data, pasto, ...voce, porzioni: voce.ricetta_id ? porzioni : undefined, per_utente: perMe ? utente : null });
      chiudi(true);
    } catch (e) {
      setAttesa(false);
      setErrore(`Non aggiunto: ${(e as Error).message}`);
    }
  }

  const aggiungiNota = (e: FormEvent) => {
    e.preventDefault();
    if (nota.trim()) void aggiungi({ nota: nota.trim() });
  };

  return (
    <main className="scegli-pasto">
      <div className="barra">
        <button className="indietro secondario" onClick={() => chiudi(false)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Menù
        </button>
      </div>
      <header className="ricetta-testa">
        <h1>
          {nomeGiorno(data)}, {nomePasto.toLowerCase()}
        </h1>
      </header>

      <div className="viste due per-chi" role="group" aria-label="Per chi">
        <button
          aria-pressed={!perMe}
          onClick={() => {
            setPerMe(false);
            setPorzioni(casa.porzioni_predefinite);
          }}
        >
          Per tutti
        </button>
        <button
          aria-pressed={perMe}
          onClick={() => {
            setPerMe(true);
            setPorzioni(1);
          }}
        >
          Solo per me
        </button>
      </div>

      <div className="riga-porzioni">
        <span>Per quante porzioni</span>
        <Porzioni valore={porzioni} cambia={setPorzioni} />
      </div>

      <div className="ricerca">
        <label htmlFor="cerca-pasto" className="solo-lettori">
          Cerca una ricetta
        </label>
        <input
          id="cerca-pasto"
          type="search"
          placeholder="Cerca per nome o ingrediente"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
        />
      </div>

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      <ul className="ricette scelta">
        {ricette.map((r) => (
          <li key={r.id}>
            <button disabled={attesa} onClick={() => aggiungi({ ricetta_id: r.id })}>
              <Miniatura ricetta={r} />
              <span className="testi">
                <span className="titolo">{r.titolo}</span>
                <span className="dettagli">
                  {[
                    formattaMinuti(r.minuti_totali),
                    r.kcal !== null && `${formattaValore(r.kcal)} kcal`,
                    r.proteine_g !== null && `${formattaValore(r.proteine_g)} g proteine`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {ricette.length === 0 && <p className="nota">Nessuna ricetta con questo nome o ingrediente.</p>}

      <form onSubmit={aggiungiNota} className="modulo nota-libera">
        <label htmlFor="nota-pasto">Oppure scrivi una nota</label>
        <div className="riga">
          <input id="nota-pasto" placeholder="Cena fuori, avanzi…" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button type="submit" className="contorno" disabled={attesa || !nota.trim()}>
            Aggiungi
          </button>
        </div>
      </form>
    </main>
  );
}

export default function Menu({ dati, casa, utente, settimana, setSettimana }: Props) {
  const [voci, setVoci] = useState<VocePiano[] | null>(() => leggiCache<VocePiano[]>(`piano.${settimana}`));
  const [errore, setErrore] = useState<string | null>(null);
  const [scelta, setScelta] = useState<{ data: string; pasto: Pasto; soloPerMe: boolean; alPostoDi?: VocePiano } | null>(null);
  // di base ognuno vede le voci comuni e le proprie; con l'interruttore anche quelle personali degli altri
  const [tuttaCasa, setTuttaCasa] = useState(() => leggiCache<boolean>('menu.tutta-casa') ?? false);
  const [persone, setPersone] = useState<Record<string, string>>(() => leggiCache<Record<string, string>>('persone') ?? {});
  // dopo "Per me qualcos'altro": la voce comune da cui proporre di togliere una porzione
  const [daRidurre, setDaRidurre] = useState<VocePiano | null>(null);
  // quello che serve a "Proponi settimana": dispensa, preferenze e obiettivi di tutta la casa
  const [contesto, setContesto] = useState<Contesto | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  // per "Un'altra": le proposte già viste al posto di ogni voce, per non riproporle subito
  const [viste, setViste] = useState<Record<string, string[]>>({});
  const [aperta, setAperta] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  const fine = piuGiorni(settimana, 6);
  const questaSettimana = lunedi(oggi());
  const perId = useMemo(() => new Map(dati.ricette.map((r) => [r.id, r])), [dati.ricette]);

  const carica = useCallback(async () => {
    try {
      const righe = await leggiPiano(casa.id, settimana, piuGiorni(settimana, 6));
      setVoci(righe);
      setErrore(null);
      scriviCache(`piano.${settimana}`, righe);
    } catch {
      setErrore('Senza connessione: vedi l’ultima versione salvata e non puoi modificare il menù.');
    }
  }, [casa.id, settimana]);

  useEffect(() => {
    setVoci(leggiCache<VocePiano[]>(`piano.${settimana}`));
    setAperta(null);
    void carica();
  }, [settimana, carica]);

  useEffect(() => {
    leggiPersone(casa.id).then(
      (p) => {
        setPersone(p);
        scriviCache('persone', p);
      },
      () => undefined,
    );
  }, [casa.id]);

  async function fai(azione: () => Promise<void>) {
    setAttesa(true);
    let riuscita = true;
    try {
      await azione();
      await carica();
    } catch (e) {
      setErrore(`Modifica non salvata: ${(e as Error).message}`);
      riuscita = false;
    }
    setAttesa(false);
    return riuscita;
  }

  useEffect(() => {
    Promise.all([leggiDispensa(casa.id), leggiPreferenzeCasa(casa.id), leggiPreferenzePersone(casa.id), leggiObiettiviCasa(casa.id), leggiPersone(casa.id)]).then(
      ([confezioni, prefCasa, prefPersone, obiettivi, nomi]) =>
        setContesto({
          ricette: dati.ricette,
          ingredienti: dati.ingredienti,
          confezioni,
          casa: prefCasa,
          porzioniCasa: casa.porzioni_predefinite,
          persone: Object.keys(nomi).map((id) => ({ utente: id, pref: prefPersone[id] ?? {}, obiettivi: obiettivi[id] ?? null })),
        }),
      () => setContesto(null),
    );
  }, [casa.id, casa.porzioni_predefinite, dati.ricette, dati.ingredienti]);

  async function proponi() {
    setMessaggio(null);
    if (!contesto || !voci) {
      setErrore('Per proporre la settimana serve la connessione. Riprova tra poco.');
      return;
    }
    if (!contesto.casa.compilate) {
      // la prima volta si passa dal questionario; al ritorno la proposta parte da sola
      sessionStorage.setItem(PROPONI_DOPO, '1');
      vai('/preferenze');
      return;
    }
    const dal = settimana < questaSettimana ? piuGiorni(settimana, 7) : settimana === questaSettimana ? oggi() : settimana;
    const nuove = proponiSettimana(contesto, settimana, voci, dal);
    if (nuove.length === 0) {
      setMessaggio(settimana < questaSettimana ? 'Questa settimana è già passata.' : 'Non ci sono spazi vuoti da riempire con le tue preferenze.');
      return;
    }
    if (!(await fai(() => aggiungiVoci(casa.id, nuove)))) return;
    const comuni = nuove.filter((v) => !v.per_utente).length;
    setMessaggio(
      `Ho proposto ${comuni} ${comuni === 1 ? 'pasto comune' : 'pasti comuni'}` +
        (nuove.length > comuni ? ` e ${nuove.length - comuni} tra colazioni e merende personali, per chi nella casa ha degli obiettivi.` : '.') +
        ' Tocca una voce per cambiarla.',
    );
  }

  // dopo il questionario del primo utilizzo: la proposta parte appena ci sono i dati
  useEffect(() => {
    if (contesto?.casa.compilate && voci && sessionStorage.getItem(PROPONI_DOPO)) {
      sessionStorage.removeItem(PROPONI_DOPO);
      void proponi();
    }
    // deve scattare una volta sola, quando contesto e menù sono pronti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contesto, voci === null]);

  /** "Un'altra": sostituisce una voce proposta con la proposta successiva. */
  function unAltra(v: VocePiano) {
    if (!contesto || !voci) return;
    const scartate = [...(viste[v.id] ?? []), v.ricetta_id ?? v.nota ?? ''];
    const possibili = alternative(contesto, settimana, voci, v);
    const prossima = possibili.find((x) => !scartate.includes(x.ricetta_id ?? x.nota ?? '')) ?? possibili[0];
    if (!prossima) {
      setMessaggio('Non ho altre proposte per questo pasto con le preferenze attuali.');
      return;
    }
    // finite le alternative si ricomincia dalla prima
    setViste({ ...viste, [v.id]: possibili.some((x) => !scartate.includes(x.ricetta_id ?? x.nota ?? '')) ? scartate : [] });
    void fai(() => modificaPiano(v.id, { ricetta_id: prossima.ricetta_id, nota: prossima.nota, alimenti: prossima.alimenti, porzioni: prossima.porzioni }));
  }

  function soloPerMe(v: VocePiano) {
    if (!contesto || !voci) return;
    const mia = alternativaPerMe(contesto, settimana, voci, v, utente);
    if (!mia) {
      setMessaggio('Non trovo un’alternativa adatta con le preferenze attuali.');
      return;
    }
    void fai(() => aggiungiVoci(casa.id, [mia]));
    if ((v.porzioni ?? 0) > 1) setDaRidurre(v);
  }

  async function generaLista() {
    setAttesa(true);
    const { error } = await supabase.rpc('genera_lista_spesa', { p_casa: casa.id, p_dal: settimana, p_al: fine });
    setAttesa(false);
    if (error) {
      setErrore(`Lista non generata: ${error.message}`);
      return;
    }
    // ingredienti di base usati dal menù: la lista li propone, senza aggiungerli da sola
    const base = new Map<string, string>();
    for (const v of voci ?? []) {
      if (v.cucinata_il || !v.ricetta_id) continue;
      for (const i of perId.get(v.ricetta_id)?.ingredienti ?? []) {
        if (i.base && !i.facoltativo && i.nome !== 'acqua') base.set(i.ingrediente_id, i.nome);
      }
    }
    scriviCache('lista.base', [...base].map(([id, nome]) => ({ id, nome })));
    vaiAScheda('/lista');
  }

  if (scelta) {
    return (
      <ScegliPasto
        dati={dati}
        casa={casa}
        utente={utente}
        data={scelta.data}
        pasto={scelta.pasto}
        soloPerMe={scelta.soloPerMe}
        chiudi={(aggiunto) => {
          const comune = scelta.alPostoDi;
          setScelta(null);
          if (!aggiunto) return;
          void carica();
          if (comune && (comune.porzioni ?? 0) > 1) setDaRidurre(comune);
        }}
      />
    );
  }

  const daComprare = (voci ?? []).filter((v) => v.ricetta_id && !v.cucinata_il).length;

  return (
    <main className="menu">
      <header className="home-testa">
        <h1>Menù</h1>
        {settimana !== questaSettimana && (
          <button className="secondario" onClick={() => setSettimana(questaSettimana)}>
            Questa settimana
          </button>
        )}
      </header>

      <div className="settimana">
        <button className="tondo" aria-label="Settimana precedente" onClick={() => setSettimana(piuGiorni(settimana, -7))}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p aria-live="polite">{nomeSettimana(settimana)}</p>
        <button className="tondo" aria-label="Settimana successiva" onClick={() => setSettimana(piuGiorni(settimana, 7))}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {Object.keys(persone).length > 1 && (
        <label className="spunta tutta-casa">
          <input
            type="checkbox"
            checked={tuttaCasa}
            onChange={(e) => {
              setTuttaCasa(e.target.checked);
              scriviCache('menu.tutta-casa', e.target.checked);
            }}
          />
          Mostra anche le voci personali degli altri
        </label>
      )}

      {daRidurre && (
        <div className="avviso-riduci" role="status">
          <p>
            Ora hai una voce solo per te. Vuoi togliere la tua porzione da «{perId.get(daRidurre.ricetta_id ?? '')?.titolo ?? 'la voce comune'}»?
          </p>
          <div className="comandi">
            <button
              className="contorno"
              disabled={attesa}
              onClick={() => {
                const voce = daRidurre;
                setDaRidurre(null);
                void fai(() => modificaPiano(voce.id, { porzioni: (voce.porzioni ?? 2) - 1 }));
              }}
            >
              Togli una porzione
            </button>
            <button className="secondario" onClick={() => setDaRidurre(null)}>
              Lascia com’è
            </button>
          </div>
        </div>
      )}

      <div className="azioni-menu">
        <button className="contorno" disabled={attesa} onClick={() => void proponi()}>
          Proponi settimana
        </button>
        <button className="secondario" onClick={() => vai('/preferenze')}>
          Preferenze
        </button>
      </div>
      {messaggio && (
        <p className="stato-rete" role="status">
          {messaggio}
        </p>
      )}
      {(voci ?? []).some((v) => v.proposta && !v.cucinata_il) && (
        <div className="avviso-riduci">
          <p>Le voci segnate «proposta» le ho messe io. Puoi cambiarle una a una, tenerle o toglierle tutte.</p>
          <div className="comandi">
            <button
              className="contorno"
              disabled={attesa}
              onClick={() => {
                setMessaggio(null);
                void fai(() => tieniProposta(casa.id, settimana, fine));
              }}
            >
              Tieni tutto
            </button>
            <button
              className="contorno rosso"
              disabled={attesa}
              onClick={() => {
                setMessaggio(null);
                void fai(() => annullaProposta(casa.id, settimana, fine));
              }}
            >
              Annulla la proposta
            </button>
          </div>
        </div>
      )}

      {voci === null ? (
        !errore && <p className="nota">Carico il menù…</p>
      ) : (
        <>
          {Array.from({ length: 7 }, (_, n) => piuGiorni(settimana, n)).map((giorno) => (
            <section key={giorno} className={`giorno${giorno === oggi() ? ' oggi' : ''}`}>
              <h2>
                {nomeGiorno(giorno)}
                {giorno === oggi() && <span> oggi</span>}
              </h2>
              {PASTI.map((p) => {
                const delPasto = voci.filter(
                  (v) => v.data === giorno && v.pasto === p.valore && (v.per_utente === null || v.per_utente === utente || tuttaCasa),
                );
                return (
                  <div key={p.valore} className="pasto">
                    <h3>{p.breve}</h3>
                    <div className="pasto-voci">
                      {delPasto.map((v) => {
                        const ricetta = v.ricetta_id ? perId.get(v.ricetta_id) : undefined;
                        const porzioni = v.porzioni ?? ricetta?.porzioni ?? casa.porzioni_predefinite;
                        const diChi = v.per_utente === null ? null : v.per_utente === utente ? 'solo per te' : `solo per ${persone[v.per_utente] ?? 'un’altra persona'}`;
                        const mia = v.per_utente === null || v.per_utente === utente;
                        const alimenti = (v.alimenti ?? [])
                          .map((a) => {
                            const i = dati.ingredienti.find((x) => x.id === a.ingrediente_id);
                            return i ? `${a.quantita.toLocaleString('it-IT')} ${i.unita_base === 'unita' ? (a.quantita === 1 ? 'pezzo' : 'pezzi') : i.unita_base} di ${i.nome}` : null;
                          })
                          .filter(Boolean)
                          .join(', ');
                        const lontano = !!contesto && !v.cucinata_il && lontanoDagliObiettivi(contesto, v, utente);
                        return (
                          <div key={v.id} className="pasto-voce">
                            <button
                              className="riga-voce"
                              aria-expanded={aperta === v.id}
                              data-cucinata={!!v.cucinata_il}
                              onClick={() => setAperta(aperta === v.id ? null : v.id)}
                            >
                              <span className="titolo">{ricetta?.titolo ?? v.nota ?? 'Ricetta non più disponibile'}</span>
                              {(ricetta || v.cucinata_il || diChi || v.proposta || alimenti) && (
                                <span className="dettagli">
                                  {[v.proposta && !v.cucinata_il && 'proposta', diChi, ricetta && nomePorzioni(porzioni), alimenti, v.cucinata_il && 'cucinata']
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                              )}
                            </button>
                            {aperta === v.id && (
                              <div className="pannello-voce">
                                {ricetta && (
                                  <div className="riga-porzioni">
                                    <span>Porzioni</span>
                                    <Porzioni valore={porzioni} cambia={(n) => fai(() => modificaPiano(v.id, { porzioni: n }))} />
                                  </div>
                                )}
                                {lontano && (
                                  <p className="nota">Anche cambiando la porzione, questo piatto resta lontano dai tuoi obiettivi per questo pasto.</p>
                                )}
                                <div className="comandi">
                                  {v.proposta && !v.cucinata_il && mia && (
                                    <button className="contorno" disabled={attesa} onClick={() => unAltra(v)}>
                                      Un’altra
                                    </button>
                                  )}
                                  {lontano && (
                                    <button className="contorno" disabled={attesa} onClick={() => soloPerMe(v)}>
                                      Proponimi un’alternativa solo per me
                                    </button>
                                  )}
                                  {ricetta && (
                                    <button className="contorno" onClick={() => vai(`/ricetta/${ricetta.id}`)}>
                                      Apri la ricetta
                                    </button>
                                  )}
                                  {ricetta && (
                                    <button
                                      className="contorno"
                                      disabled={attesa}
                                      onClick={() =>
                                        fai(() => modificaPiano(v.id, { cucinata_il: v.cucinata_il ? null : new Date().toISOString() }))
                                      }
                                    >
                                      {v.cucinata_il ? 'Non l’ho cucinata' : 'L’ho cucinata'}
                                    </button>
                                  )}
                                  {v.per_utente === null && (
                                    <button
                                      className="contorno"
                                      onClick={() => {
                                        setScelta({ data: giorno, pasto: p.valore, soloPerMe: true, alPostoDi: v });
                                        window.scrollTo(0, 0);
                                      }}
                                    >
                                      Per me qualcos’altro
                                    </button>
                                  )}
                                  {mia && (
                                    <button
                                      className="contorno"
                                      disabled={attesa}
                                      onClick={() => fai(() => modificaPiano(v.id, { per_utente: v.per_utente ? null : utente }))}
                                    >
                                      {v.per_utente ? 'Rendila per tutti' : 'Rendila solo per me'}
                                    </button>
                                  )}
                                  <button className="contorno rosso" disabled={attesa} onClick={() => fai(() => togliDalPiano(v.id))}>
                                    Togli dal menù
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        className="aggiungi-pasto"
                        aria-label={`Aggiungi a ${nomeGiorno(giorno).toLowerCase()}, ${p.nome.toLowerCase()}`}
                        disabled={!!errore && voci !== null && !navigator.onLine}
                        onClick={() => {
                          setScelta({ data: giorno, pasto: p.valore, soloPerMe: eMerenda(p.valore) });
                          window.scrollTo(0, 0);
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                          <path d="M9 3v12M3 9h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {delPasto.length === 0 && <span>Aggiungi</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}

          <section className="genera">
            <button disabled={attesa || daComprare === 0} onClick={generaLista}>
              {attesa ? 'Un momento…' : 'Genera la lista della spesa'}
            </button>
            <p className="nota">
              {daComprare === 0
                ? 'Aggiungi almeno una ricetta alla settimana per generare la lista.'
                : 'Somma gli ingredienti di questa settimana, esclusi i pasti già cucinati, e toglie quello che hai già in dispensa. Sostituisce le voci generate in precedenza; quelle aggiunte a mano restano.'}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
