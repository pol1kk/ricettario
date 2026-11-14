import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { formattaMinuti, formattaValore, leggiCache, scriviCache, semplifica, type Casa, type Dati, type Ricetta } from '../lib/dati';
import { lunedi, nomeGiorno, nomeSettimana, oggi, piuGiorni } from '../lib/date';
import { PASTI, aggiungiAlPiano, leggiPiano, modificaPiano, nomePorzioni, togliDalPiano, type Pasto, type VocePiano } from '../lib/piano';
import { vai, vaiAScheda } from '../lib/rotta';
import { Miniatura } from './Copertina';
import Porzioni from './Porzioni';

type Props = { dati: Dati; casa: Casa; settimana: string; setSettimana: (s: string) => void };

function ScegliPasto({
  dati,
  casa,
  data,
  pasto,
  chiudi,
}: {
  dati: Dati;
  casa: Casa;
  data: string;
  pasto: Pasto;
  chiudi: (aggiunto: boolean) => void;
}) {
  const [testo, setTesto] = useState('');
  const [nota, setNota] = useState('');
  const [porzioni, setPorzioni] = useState(casa.porzioni_predefinite);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const nomePasto = PASTI.find((p) => p.valore === pasto)!.nome;

  const ricette = useMemo(() => {
    const parole = semplifica(testo).split(/\s+/).filter(Boolean);
    // prima le ricette che hanno un tag con il nome del pasto (per esempio "colazione")
    const adatta = (r: Ricetta) => (r.tag.some((t) => t.nome === pasto) ? 0 : 1);
    return dati.ricette.filter((r) => parole.every((p) => r.cerca.includes(p))).sort((a, b) => adatta(a) - adatta(b));
  }, [dati.ricette, testo, pasto]);

  async function aggiungi(voce: { ricetta_id?: string; nota?: string }) {
    setAttesa(true);
    setErrore(null);
    try {
      await aggiungiAlPiano(casa.id, { data, pasto, ...voce, porzioni: voce.ricetta_id ? porzioni : undefined });
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

export default function Menu({ dati, casa, settimana, setSettimana }: Props) {
  const [voci, setVoci] = useState<VocePiano[] | null>(() => leggiCache<VocePiano[]>(`piano.${settimana}`));
  const [errore, setErrore] = useState<string | null>(null);
  const [scelta, setScelta] = useState<{ data: string; pasto: Pasto } | null>(null);
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

  async function fai(azione: () => Promise<void>) {
    setAttesa(true);
    try {
      await azione();
      await carica();
    } catch (e) {
      setErrore(`Modifica non salvata: ${(e as Error).message}`);
    }
    setAttesa(false);
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
        data={scelta.data}
        pasto={scelta.pasto}
        chiudi={(aggiunto) => {
          setScelta(null);
          if (aggiunto) void carica();
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
                const delPasto = voci.filter((v) => v.data === giorno && v.pasto === p.valore);
                return (
                  <div key={p.valore} className="pasto">
                    <h3>{p.nome}</h3>
                    <div className="pasto-voci">
                      {delPasto.map((v) => {
                        const ricetta = v.ricetta_id ? perId.get(v.ricetta_id) : undefined;
                        const porzioni = v.porzioni ?? ricetta?.porzioni ?? casa.porzioni_predefinite;
                        return (
                          <div key={v.id} className="pasto-voce">
                            <button
                              className="riga-voce"
                              aria-expanded={aperta === v.id}
                              data-cucinata={!!v.cucinata_il}
                              onClick={() => setAperta(aperta === v.id ? null : v.id)}
                            >
                              <span className="titolo">{ricetta?.titolo ?? v.nota ?? 'Ricetta non più disponibile'}</span>
                              {(ricetta || v.cucinata_il) && (
                                <span className="dettagli">
                                  {[ricetta && nomePorzioni(porzioni), v.cucinata_il && 'cucinata'].filter(Boolean).join(', ')}
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
                                <div className="comandi">
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
                                      {v.cucinata_il ? 'Non l’ho cucinata' : 'Ho cucinato'}
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
                          setScelta({ data: giorno, pasto: p.valore });
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
                : 'Somma gli ingredienti di questa settimana, esclusi i pasti già cucinati. Sostituisce le voci generate in precedenza; quelle aggiunte a mano restano.'}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
