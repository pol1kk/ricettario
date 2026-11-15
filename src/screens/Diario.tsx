import { useCallback, useEffect, useMemo, useState } from 'react';
import { formattaValore, leggiCache, scriviCache, type Casa, type Dati } from '../lib/dati';
import { daIso, lunedi, oggi, piuGiorni } from '../lib/date';
import {
  CAMPI_VALORI,
  NOMI_VALORI,
  OBIETTIVI_VUOTI,
  aggiungiVoce,
  eliminaVoce,
  haObiettivo,
  leggiDiario,
  leggiNumero,
  leggiObiettivi,
  modificaVoce,
  moltiplica,
  nomeQuantita,
  obiettivoDel,
  somma,
  valoriRicetta,
  type CampoValore,
  type Obiettivi,
  type Valori,
  type VoceDiario,
} from '../lib/diario';
import { PASTI, leggiPiano, modificaPiano, type Pasto, type VocePiano } from '../lib/piano';
import { vai } from '../lib/rotta';
import AggiungiAlDiario from './AggiungiAlDiario';
import { CampiValori, Sintesi, inTesti } from './ValoriDiario';

type Props = { dati: Dati; casa: Casa; utente: string; giorno: string; setGiorno: (g: string) => void };

// in italiano i numeri di quattro cifre non prendono il punto da soli: qui si vuole "1.593"
const GRUPPI = { useGrouping: 'always', maximumFractionDigits: 0 } as const;

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function titoloGiorno(s: string): string {
  const lungo = daIso(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  if (s === oggi()) return 'Oggi';
  if (s === piuGiorni(oggi(), -1)) return 'Ieri';
  if (s === piuGiorni(oggi(), 1)) return 'Domani';
  return maiuscola(lungo);
}

/** Barra di avanzamento verso l'obiettivo; oltre il 100% resta piena. */
function Misura({ valore, obiettivo }: { valore: number; obiettivo: number }) {
  const pieno = obiettivo > 0 ? Math.min(100, (valore / obiettivo) * 100) : 0;
  return (
    <span className="misura" data-oltre={valore > obiettivo * 1.03} aria-hidden="true">
      <span style={{ width: `${pieno}%` }} />
    </span>
  );
}

function Riepilogo({ totali, obiettivo }: { totali: Record<CampoValore, number>; obiettivo: Valori }) {
  const kcal = Math.round(totali.kcal);
  const meta = obiettivo.kcal;
  return (
    <section className="riepilogo" aria-label="Riepilogo del giorno">
      <div className="calorie">
        <p className="grande">
          <strong>{kcal.toLocaleString('it-IT', GRUPPI)}</strong> kcal
        </p>
        {meta !== null && (
          <p className="resto">
            {kcal <= meta
              ? `ne restano ${(meta - kcal).toLocaleString('it-IT', GRUPPI)} su ${meta.toLocaleString('it-IT', GRUPPI)}`
              : `${(kcal - meta).toLocaleString('it-IT', GRUPPI)} oltre le ${meta.toLocaleString('it-IT', GRUPPI)}`}
          </p>
        )}
      </div>
      {meta !== null && <Misura valore={kcal} obiettivo={meta} />}
      <dl className="macro">
        {CAMPI_VALORI.filter((c) => c !== 'kcal').map((c) => (
          <div key={c} data-macro={c}>
            <dt>{NOMI_VALORI[c].nome}</dt>
            <dd>
              {formattaValore(Math.round(totali[c]))}
              {obiettivo[c] !== null ? <span> / {formattaValore(obiettivo[c]!)} g</span> : <span> g</span>}
            </dd>
            {obiettivo[c] !== null && <Misura valore={totali[c]} obiettivo={obiettivo[c]!} />}
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Modifica di una voce già nel diario: quantità (i valori seguono in proporzione) oppure, per le voci a mano, i valori. */
function PannelloVoce({
  voce,
  attesa,
  salva,
  togli,
}: {
  voce: VoceDiario;
  attesa: boolean;
  salva: (campi: Partial<VoceDiario>) => void;
  togli: () => void;
}) {
  const [quantita, setQuantita] = useState(voce.quantita === null ? '' : String(voce.quantita).replace('.', ','));
  const [nome, setNome] = useState(voce.nome);
  const [testi, setTesti] = useState(() => inTesti(voce));
  const [pasto, setPasto] = useState<Pasto>(voce.pasto);

  const q = leggiNumero(quantita);
  const aMano = voce.quantita === null;
  const nuovi: Valori = aMano
    ? { kcal: leggiNumero(testi.kcal), proteine_g: leggiNumero(testi.proteine_g), carboidrati_g: leggiNumero(testi.carboidrati_g), grassi_g: leggiNumero(testi.grassi_g) }
    : q && voce.quantita
      ? moltiplica(voce, q / voce.quantita)
      : voce;
  const valido = aMano ? nome.trim() !== '' : !!q;

  return (
    <form
      className="pannello-voce"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        salva(aMano ? { nome: nome.trim(), pasto, ...nuovi } : { quantita: q!, pasto, ...nuovi });
      }}
    >
      {aMano ? (
        <>
          <div>
            <label htmlFor={`n-${voce.id}`}>Nome</label>
            <input id={`n-${voce.id}`} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <CampiValori id={`v-${voce.id}`} testi={testi} cambia={setTesti} />
        </>
      ) : (
        <>
          <div>
            <label htmlFor={`q-${voce.id}`}>Quanto ne hai mangiato</label>
            <span className="campo-unita">
              <input id={`q-${voce.id}`} inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
              <span>{voce.unita === 'unita' ? 'pezzi' : voce.unita}</span>
            </span>
          </div>
          <p className="anteprima">
            <Sintesi valori={nuovi} />
          </p>
        </>
      )}
      <div>
        <label htmlFor={`p-${voce.id}`}>Pasto</label>
        <select id={`p-${voce.id}`} value={pasto} onChange={(e) => setPasto(e.target.value as Pasto)}>
          {PASTI.map((p) => (
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
        <button type="button" className="contorno rosso" disabled={attesa} onClick={togli}>
          Togli dal diario
        </button>
      </div>
    </form>
  );
}

function Settimana({
  lunedi: dal,
  voci,
  obiettivi,
  apri,
}: {
  lunedi: string;
  voci: VoceDiario[];
  obiettivi: Obiettivi;
  apri: (giorno: string) => void;
}) {
  const giorni = Array.from({ length: 7 }, (_, n) => {
    const data = piuGiorni(dal, n);
    const sue = voci.filter((v) => v.data === data);
    return { data, totali: somma(sue), obiettivo: obiettivoDel(obiettivi, data), vuoto: sue.length === 0 };
  });
  const pieni = giorni.filter((g) => !g.vuoto);
  const media = somma(pieni.map((g) => g.totali));
  for (const c of CAMPI_VALORI) media[c] = pieni.length ? media[c] / pieni.length : 0;
  // senza obiettivo le barre si misurano sul giorno più ricco della settimana
  const massimo = Math.max(1, ...giorni.map((g) => g.totali.kcal));

  return (
    <>
      <section className="riepilogo" aria-label="Media della settimana">
        <div className="calorie">
          <p className="grande">
            <strong>{Math.round(media.kcal).toLocaleString('it-IT', GRUPPI)}</strong> kcal al giorno
          </p>
          <p className="resto">
            {pieni.length === 0 ? 'nessun giorno registrato' : `media su ${pieni.length} ${pieni.length === 1 ? 'giorno registrato' : 'giorni registrati'}`}
          </p>
        </div>
        <dl className="macro">
          {CAMPI_VALORI.filter((c) => c !== 'kcal').map((c) => (
            <div key={c} data-macro={c}>
              <dt>{NOMI_VALORI[c].nome}</dt>
              <dd>
                {formattaValore(Math.round(media[c]))}
                <span> g</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <ul className="giorni-settimana">
        {giorni.map((g) => (
          <li key={g.data}>
            <button onClick={() => apri(g.data)} data-oggi={g.data === oggi()}>
              <span className="nome">
                {maiuscola(daIso(g.data).toLocaleDateString('it-IT', { weekday: 'short' }))} {daIso(g.data).getDate()}
              </span>
              <span className="barra-giorno">
                <Misura valore={g.totali.kcal} obiettivo={g.obiettivo.kcal ?? massimo} />
                {g.vuoto ? (
                  'Niente di registrato'
                ) : (
                  <Sintesi
                    valori={{
                      kcal: Math.round(g.totali.kcal),
                      proteine_g: Math.round(g.totali.proteine_g),
                      carboidrati_g: Math.round(g.totali.carboidrati_g),
                      grassi_g: Math.round(g.totali.grassi_g),
                    }}
                  />
                )}
              </span>
              <span className="meta">{g.obiettivo.kcal !== null && `su ${g.obiettivo.kcal.toLocaleString('it-IT', GRUPPI)}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Diario({ dati, casa, utente, giorno, setGiorno }: Props) {
  const settimana = lunedi(giorno);
  const chiave = `diario.${utente}.${settimana}`;
  const [voci, setVoci] = useState<VoceDiario[] | null>(() => leggiCache<VoceDiario[]>(chiave));
  const [piano, setPiano] = useState<VocePiano[]>(() => leggiCache<VocePiano[]>(`piano.${settimana}`) ?? []);
  const [obiettivi, setObiettivi] = useState<Obiettivi>(() => leggiCache<Obiettivi>(`obiettivi.${utente}`) ?? OBIETTIVI_VUOTI);
  const [errore, setErrore] = useState<string | null>(null);
  const [vista, setVista] = useState<'giorno' | 'settimana'>('giorno');
  const [aperta, setAperta] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [aggiunta, setAggiunta] = useState<{ pasto: Pasto; nome?: string; piano_id?: string } | null>(null);

  const perId = useMemo(() => new Map(dati.ricette.map((r) => [r.id, r])), [dati.ricette]);

  const carica = useCallback(async () => {
    try {
      const fine = piuGiorni(settimana, 6);
      const [righe, menu, mete] = await Promise.all([leggiDiario(settimana, fine), leggiPiano(casa.id, settimana, fine), leggiObiettivi()]);
      setVoci(righe);
      setPiano(menu);
      setObiettivi(mete);
      setErrore(null);
      scriviCache(chiave, righe);
      scriviCache(`piano.${settimana}`, menu);
      scriviCache(`obiettivi.${utente}`, mete);
    } catch {
      setErrore('Senza connessione: vedi l’ultima versione salvata e non puoi modificare il diario.');
    }
  }, [casa.id, settimana, chiave, utente]);

  useEffect(() => {
    setVoci(leggiCache<VoceDiario[]>(chiave));
    setPiano(leggiCache<VocePiano[]>(`piano.${settimana}`) ?? []);
    void carica();
  }, [chiave, settimana, carica]);

  useEffect(() => setAperta(null), [giorno]);

  async function fai(azione: () => Promise<void>) {
    setAttesa(true);
    try {
      await azione();
      await carica();
      setAperta(null);
    } catch (e) {
      setErrore(`Modifica non salvata: ${(e as Error).message}`);
    }
    setAttesa(false);
  }

  if (aggiunta) {
    return (
      <AggiungiAlDiario
        dati={dati}
        data={giorno}
        pasto={aggiunta.pasto}
        nomeIniziale={aggiunta.nome}
        pianoId={aggiunta.piano_id}
        chiudi={(aggiunto) => {
          setAggiunta(null);
          if (aggiunto) void carica();
        }}
      />
    );
  }

  const delGiorno = (voci ?? []).filter((v) => v.data === giorno);
  const obiettivo = obiettivoDel(obiettivi, giorno);
  // voci del menù di oggi non ancora confermate: si propongono, pronte da segnare come mangiate
  const proposte = piano.filter(
    (p) =>
      p.data === giorno &&
      !delGiorno.some((v) => v.piano_id === p.id || (p.ricetta_id !== null && v.ricetta_id === p.ricetta_id && v.pasto === p.pasto)),
  );

  function conferma(p: VocePiano) {
    const ricetta = p.ricetta_id ? perId.get(p.ricetta_id) : undefined;
    if (!ricetta) {
      // una nota del menù ("cena fuori") non ha valori: si completano a mano
      setAggiunta({ pasto: p.pasto, nome: p.nota ?? '', piano_id: p.id });
      window.scrollTo(0, 0);
      return;
    }
    void fai(async () => {
      await aggiungiVoce({
        data: giorno,
        pasto: p.pasto,
        nome: ricetta.titolo,
        ricetta_id: ricetta.id,
        ingrediente_id: null,
        piano_id: p.id,
        quantita: 1,
        unita: 'porzioni',
        ...valoriRicetta(ricetta, 1),
      });
      // se è stata mangiata, è stata anche cucinata: il menù la segna e la lista non la ricompra
      if (!p.cucinata_il) await modificaPiano(p.id, { cucinata_il: new Date().toISOString() });
    });
  }

  return (
    <main className="diario">
      <header className="home-testa">
        <h1>Diario</h1>
        <button className="secondario" onClick={() => vai('/obiettivi')}>
          Obiettivi
        </button>
      </header>

      <div className="settimana">
        <button className="tondo" aria-label="Giorno precedente" onClick={() => setGiorno(piuGiorni(giorno, vista === 'giorno' ? -1 : -7))}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p aria-live="polite">
          {vista === 'giorno'
            ? titoloGiorno(giorno)
            : `${daIso(settimana).getDate()} – ${daIso(piuGiorni(settimana, 6)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`}
        </p>
        <button className="tondo" aria-label="Giorno successivo" onClick={() => setGiorno(piuGiorni(giorno, vista === 'giorno' ? 1 : 7))}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="sotto-data">
        <div className="viste due" role="group" aria-label="Periodo">
          <button aria-pressed={vista === 'giorno'} onClick={() => setVista('giorno')}>
            Giorno
          </button>
          <button aria-pressed={vista === 'settimana'} onClick={() => setVista('settimana')}>
            Settimana
          </button>
        </div>
        {giorno !== oggi() && (
          <button className="secondario" onClick={() => setGiorno(oggi())}>
            Torna a oggi
          </button>
        )}
      </div>

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {voci === null ? (
        !errore && <p className="nota">Carico il diario…</p>
      ) : vista === 'settimana' ? (
        <Settimana
          lunedi={settimana}
          voci={voci}
          obiettivi={obiettivi}
          apri={(g) => {
            setGiorno(g);
            setVista('giorno');
          }}
        />
      ) : (
        <>
          <Riepilogo totali={somma(delGiorno)} obiettivo={obiettivo} />
          {!haObiettivo(obiettivo) && (
            <button className="invito-obiettivi secondario" onClick={() => vai('/obiettivi')}>
              Imposta un obiettivo per vedere quanto ti resta
            </button>
          )}

          {PASTI.map((p) => {
            const sue = delGiorno.filter((v) => v.pasto === p.valore);
            const daMenu = proposte.filter((v) => v.pasto === p.valore);
            const kcal = Math.round(somma(sue).kcal);
            return (
              <section key={p.valore} className="pasto-diario">
                <header>
                  <h2>{p.nome}</h2>
                  {sue.length > 0 && <span className="subtotale">{kcal.toLocaleString('it-IT', GRUPPI)} kcal</span>}
                </header>

                {sue.map((v) => (
                  <div key={v.id} className="pasto-voce">
                    <button className="riga-voce" aria-expanded={aperta === v.id} onClick={() => setAperta(aperta === v.id ? null : v.id)}>
                      <span className="titolo">{v.nome}</span>
                      <span className="dettagli">
                        {v.quantita !== null && v.unita && <>{nomeQuantita(v.quantita, v.unita)}, </>}
                        <Sintesi valori={v} />
                      </span>
                    </button>
                    {aperta === v.id && (
                      <PannelloVoce
                        voce={v}
                        attesa={attesa}
                        salva={(campi) => fai(() => modificaVoce(v.id, campi))}
                        togli={() => fai(() => eliminaVoce(v.id))}
                      />
                    )}
                  </div>
                ))}

                {daMenu.map((v) => {
                  const ricetta = v.ricetta_id ? perId.get(v.ricetta_id) : undefined;
                  return (
                    <div key={v.id} className="proposta">
                      <span className="testi">
                        <span className="titolo">{ricetta?.titolo ?? v.nota ?? 'Voce del menù'}</span>
                        <span className="dettagli">
                          Dal menù{ricetta && <>, 1 porzione, </>}
                          {ricetta && <Sintesi valori={valoriRicetta(ricetta, 1)} />}
                        </span>
                      </span>
                      <button className="contorno" disabled={attesa} onClick={() => conferma(v)}>
                        L’ho mangiato
                      </button>
                    </div>
                  );
                })}

                <button
                  className="aggiungi-pasto"
                  aria-label={`Aggiungi a ${p.nome.toLowerCase()}`}
                  onClick={() => {
                    setAggiunta({ pasto: p.valore });
                    window.scrollTo(0, 0);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M9 3v12M3 9h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Aggiungi</span>
                </button>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
