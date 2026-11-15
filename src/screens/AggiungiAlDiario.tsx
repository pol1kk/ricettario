import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { formattaQuantita, formattaValore, semplifica, type Casa, type Dati, type Ingrediente, type Ricetta } from '../lib/dati';
import { giornoRelativo } from '../lib/date';
import {
  aggiungiVoce,
  leggiNumero,
  leggiRecenti,
  moltiplica,
  nomeQuantita,
  pesoPorzione,
  valoriAlimento,
  valoriRicetta,
  type NuovaVoce,
  type UnitaDiario,
  type Valori,
  type VoceDiario,
} from '../lib/diario';
import {
  cercaProdotto,
  cercaSuOpenFoodFacts,
  leggiDispensa,
  riassumiDispensa,
  scalaDispensa,
  type Confezione,
} from '../lib/dispensa';
import { PASTI, type Pasto } from '../lib/piano';
import { Miniatura } from './Copertina';
import { IconaCodice } from './ModuloConfezione';
import Scanner from './Scanner';
import { CampiValori, Sintesi, TESTI_VUOTI } from './ValoriDiario';

type Scheda = 'recenti' | 'ricette' | 'alimenti' | 'mano';
type Scelta =
  | { tipo: 'ricetta'; ricetta: Ricetta }
  | { tipo: 'alimento'; alimento: Ingrediente }
  /** prodotto confezionato letto dal codice a barre: valori per 100 g o ml; `ingrediente` c'è se il codice era già collegato */
  | { tipo: 'prodotto'; nome: string; unita: 'g' | 'ml'; per100: Valori; formato: number | null; ingrediente: Ingrediente | null };

const NOMI_UNITA: Record<UnitaDiario, string> = { porzioni: 'porzioni', g: 'g', ml: 'ml', unita: 'pezzi' };

export default function AggiungiAlDiario({
  dati,
  casa,
  data,
  pasto,
  nomeIniziale,
  pianoId,
  chiudi,
}: {
  dati: Dati;
  casa: Casa;
  data: string;
  pasto: Pasto;
  /** quando si conferma una nota del menù: apre la voce a mano con il nome già scritto */
  nomeIniziale?: string;
  pianoId?: string;
  chiudi: (aggiunto: boolean) => void;
}) {
  const [scheda, setScheda] = useState<Scheda>(nomeIniziale !== undefined ? 'mano' : 'recenti');
  const [recenti, setRecenti] = useState<VoceDiario[] | null>(null);
  const [testo, setTesto] = useState('');
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [quantita, setQuantita] = useState('1');
  const [inGrammi, setInGrammi] = useState(false);
  const [nome, setNome] = useState(nomeIniziale ?? '');
  const [testi, setTesti] = useState(TESTI_VUOTI);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [scanner, setScanner] = useState(false);
  const [confezioni, setConfezioni] = useState<Confezione[]>([]);
  const [scala, setScala] = useState(true);

  const nomePasto = PASTI.find((p) => p.valore === pasto)!.nome.toLowerCase();
  const catalogo = useMemo(() => new Map(dati.ingredienti.map((i) => [i.id, i])), [dati.ingredienti]);
  const parole = useMemo(() => semplifica(testo).split(/\s+/).filter(Boolean), [testo]);

  useEffect(() => {
    // serve solo a sapere se ciò che si mangia è in dispensa, per proporre di scalarlo
    leggiDispensa(casa.id).then(setConfezioni, () => setConfezioni([]));
  }, [casa.id]);
  const inDispensa = useMemo(() => riassumiDispensa(confezioni), [confezioni]);

  useEffect(() => {
    leggiRecenti().then(
      (r) => {
        setRecenti(r);
        // la prima volta non c'è ancora nulla di recente: si parte dalle ricette
        if (r.length === 0) setScheda((s) => (s === 'recenti' ? 'ricette' : s));
      },
      () => setRecenti([]),
    );
  }, []);

  const ricette = useMemo(() => dati.ricette.filter((r) => parole.every((p) => r.cerca.includes(p))), [dati.ricette, parole]);
  const alimenti = useMemo(
    () => dati.ingredienti.filter((i) => i.kcal_100 !== null && parole.every((p) => semplifica(i.nome).includes(p))),
    [dati.ingredienti, parole],
  );

  async function salva(voce: Omit<NuovaVoce, 'data' | 'pasto'>, daScalare?: { ingrediente_id: string; quantita: number }) {
    setAttesa(true);
    setErrore(null);
    try {
      await aggiungiVoce({ ...voce, data, pasto });
      // la voce è già nel diario: se lo scarico fallisce non si blocca nulla, la dispensa si corregge a mano
      if (daScalare) await scalaDispensa(casa.id, null, [daScalare]).catch(() => undefined);
      chiudi(true);
    } catch (e) {
      setAttesa(false);
      setErrore(`Non aggiunto: ${(e as Error).message}. Controlla la connessione e riprova.`);
    }
  }

  function scegli(s: Scelta) {
    setScelta(s);
    setInGrammi(false);
    setScala(true);
    setQuantita(
      s.tipo === 'prodotto' ? String(s.formato ?? 100) : s.tipo === 'ricetta' || s.alimento.unita_base === 'unita' ? '1' : '100',
    );
    window.scrollTo(0, 0);
  }

  async function codiceLetto(codice: string) {
    setScanner(false);
    setAttesa(true);
    setErrore(null);
    try {
      const noto = await cercaProdotto(casa.id, codice);
      const ingrediente = (noto && dati.ingredienti.find((i) => i.id === noto.ingrediente_id)) || null;
      // prima i valori del prodotto vero, poi quelli dell'ingrediente a cui è collegato, poi l'archivio pubblico
      const trovato = noto ?? (await cercaSuOpenFoodFacts(codice).catch(() => null));
      const fonte = trovato && trovato.kcal_100 !== null ? trovato : ingrediente && ingrediente.unita_base !== 'unita' && ingrediente.kcal_100 !== null ? ingrediente : null;
      if (!trovato || !fonte) {
        setNome(trovato?.nome ?? '');
        setScheda('mano');
        setErrore(
          trovato
            ? 'Di questo prodotto non conosco i valori nutrizionali: scrivili qui sotto dall’etichetta.'
            : 'Non trovo questo codice: scrivi qui sotto cosa hai mangiato e i valori dall’etichetta.',
        );
      } else {
        scegli({
          tipo: 'prodotto',
          nome: trovato.nome || (ingrediente ? ingrediente.nome.charAt(0).toUpperCase() + ingrediente.nome.slice(1) : 'Prodotto'),
          unita: trovato.formato_unita === 'ml' || (!trovato.formato_unita && ingrediente?.unita_base === 'ml') ? 'ml' : 'g',
          per100: { kcal: fonte.kcal_100, proteine_g: fonte.proteine_100, carboidrati_g: fonte.carboidrati_100, grassi_g: fonte.grassi_100 },
          formato: trovato.formato_quantita && trovato.formato_quantita <= 500 ? trovato.formato_quantita : null,
          ingrediente,
        });
      }
    } catch (e) {
      setErrore(`Non sono riuscito a cercare il prodotto: ${(e as Error).message}. Controlla la connessione.`);
    }
    setAttesa(false);
  }

  if (scanner) return <Scanner trovato={codiceLetto} chiudi={() => setScanner(false)} />;

  const indietro = (
    <div className="barra">
      <button className="indietro secondario" onClick={() => (scelta ? setScelta(null) : chiudi(false))}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {scelta ? 'Scegli altro' : 'Diario'}
      </button>
    </div>
  );

  // ---------- secondo passo: quanto ne hai mangiato ----------
  if (scelta) {
    const q = leggiNumero(quantita);
    let valori: Valori | null = null;
    let unita: UnitaDiario;
    let titolo: string;
    let aiuto: string | null = null;
    let pesoUna: number | null = null;
    /** ingrediente da cui scalare in dispensa, se ciò che si mangia è lì e si misura allo stesso modo */
    let daDispensa: Ingrediente | null = null;

    if (scelta.tipo === 'prodotto') {
      titolo = scelta.nome;
      unita = scelta.unita;
      if (q) valori = moltiplica(scelta.per100, q / 100);
      aiuto = `${formattaValore(scelta.per100.kcal ?? 0)} kcal per 100 ${scelta.unita}.`;
      if (scelta.ingrediente && scelta.ingrediente.unita_base === scelta.unita) daDispensa = scelta.ingrediente;
    } else if (scelta.tipo === 'ricetta') {
      const r = scelta.ricetta;
      titolo = r.titolo;
      pesoUna = pesoPorzione(r, catalogo);
      unita = inGrammi && pesoUna ? 'g' : 'porzioni';
      if (q) valori = valoriRicetta(r, unita === 'g' ? q / pesoUna! : q);
      if (pesoUna) aiuto = `Una porzione pesa circa ${pesoUna} g, sommando gli ingredienti a crudo.`;
    } else {
      const a = scelta.alimento;
      titolo = a.nome.charAt(0).toUpperCase() + a.nome.slice(1);
      unita = a.unita_base;
      daDispensa = a;
      if (q) valori = valoriAlimento(a, q);
      aiuto =
        a.unita_base === 'unita'
          ? `Un pezzo pesa in media ${a.grammi_per_unita ?? '?'} g.`
          : `${formattaValore(a.kcal_100!)} kcal per 100 ${a.unita_base}.`;
    }

    const haInCasa = daDispensa && !daDispensa.base ? (inDispensa.get(daDispensa.id)?.quantita ?? 0) : 0;
    const invia = (e: FormEvent) => {
      e.preventDefault();
      if (!q || !valori) return;
      void salva(
        {
          nome: titolo,
          ricetta_id: scelta.tipo === 'ricetta' ? scelta.ricetta.id : null,
          ingrediente_id: scelta.tipo === 'alimento' ? scelta.alimento.id : scelta.tipo === 'prodotto' ? (scelta.ingrediente?.id ?? null) : null,
          piano_id: null,
          quantita: q,
          unita,
          ...valori,
        },
        daDispensa && haInCasa > 0 && scala ? { ingrediente_id: daDispensa.id, quantita: q } : undefined,
      );
    };

    return (
      <main className="aggiungi-diario">
        {indietro}
        <header className="ricetta-testa">
          <h1>{titolo}</h1>
          <p className="origine">
            {giornoRelativo(data)}, {nomePasto}
          </p>
        </header>
        <form className="modulo" onSubmit={invia}>
          {scelta.tipo === 'ricetta' && pesoUna && (
            <div className="viste due" role="group" aria-label="Unità di misura">
              <button
                type="button"
                aria-pressed={!inGrammi}
                onClick={() => {
                  setInGrammi(false);
                  setQuantita('1');
                }}
              >
                Porzioni
              </button>
              <button
                type="button"
                aria-pressed={inGrammi}
                onClick={() => {
                  setInGrammi(true);
                  setQuantita(String(pesoUna));
                }}
              >
                Grammi
              </button>
            </div>
          )}
          <label htmlFor="quanto">Quanto ne hai mangiato</label>
          <span className="campo-unita">
            <input id="quanto" inputMode="decimal" autoFocus value={quantita} onChange={(e) => setQuantita(e.target.value)} />
            <span>{NOMI_UNITA[unita]}</span>
          </span>
          {aiuto && <p className="nota">{aiuto}</p>}
          {daDispensa && haInCasa > 0 && (
            <label className="spunta">
              <input type="checkbox" checked={scala} onChange={(e) => setScala(e.target.checked)} />
              Toglilo dalla dispensa (ne hai {formattaQuantita(haInCasa, daDispensa.unita_base, 1, false)})
            </label>
          )}
          <p className="anteprima grande">{valori ? <Sintesi valori={valori} /> : 'Scrivi una quantità'}</p>
          {errore && (
            <p role="alert" className="errore">
              {errore}
            </p>
          )}
          <button type="submit" disabled={attesa || !q}>
            {attesa ? 'Salvataggio…' : `Aggiungi a ${nomePasto}`}
          </button>
        </form>
      </main>
    );
  }

  // ---------- primo passo: cosa hai mangiato ----------
  const aMano = (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    void salva({
      nome: nome.trim(),
      ricetta_id: null,
      ingrediente_id: null,
      piano_id: pianoId ?? null,
      quantita: null,
      unita: null,
      kcal: leggiNumero(testi.kcal),
      proteine_g: leggiNumero(testi.proteine_g),
      carboidrati_g: leggiNumero(testi.carboidrati_g),
      grassi_g: leggiNumero(testi.grassi_g),
    });
  };

  const SCHEDE: [Scheda, string][] = [
    ['recenti', 'Recenti'],
    ['ricette', 'Ricette'],
    ['alimenti', 'Alimenti'],
    ['mano', 'A mano'],
  ];

  return (
    <main className="aggiungi-diario">
      {indietro}
      <header className="ricetta-testa">
        <h1>Cosa hai mangiato</h1>
        <p className="origine">
          {giornoRelativo(data)}, {nomePasto}
        </p>
      </header>

      <button className="contorno scansiona" disabled={attesa} onClick={() => setScanner(true)}>
        <IconaCodice />
        {attesa ? 'Cerco il prodotto…' : 'Scansiona un prodotto confezionato'}
      </button>

      <div className="viste quattro" role="group" aria-label="Da dove scegliere">
        {SCHEDE.map(([s, n]) => (
          <button key={s} aria-pressed={scheda === s} onClick={() => setScheda(s)}>
            {n}
          </button>
        ))}
      </div>

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {(scheda === 'ricette' || scheda === 'alimenti') && (
        <div className="ricerca">
          <label htmlFor="cerca-diario" className="solo-lettori">
            Cerca
          </label>
          <input
            id="cerca-diario"
            type="search"
            placeholder={scheda === 'ricette' ? 'Cerca una ricetta' : 'Cerca un alimento'}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
        </div>
      )}

      {scheda === 'recenti' &&
        (recenti === null ? (
          <p className="nota">Carico…</p>
        ) : recenti.length === 0 ? (
          <p className="nota">Qui troverai le ultime cose che hai mangiato, da riaggiungere con un tocco.</p>
        ) : (
          <ul className="ricette scelta semplice">
            {recenti.map((v) => (
              <li key={v.id}>
                <button
                  disabled={attesa}
                  onClick={() => {
                    const { id: _id, data: _d, pasto: _p, piano_id: _pi, ...resto } = v;
                    void salva({ ...resto, piano_id: null });
                  }}
                >
                  <span className="testi">
                    <span className="titolo">{v.nome}</span>
                    <span className="dettagli">
                      {v.quantita !== null && v.unita && <>{nomeQuantita(v.quantita, v.unita)}, </>}
                      <Sintesi valori={v} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {scheda === 'ricette' && (
        <>
          <ul className="ricette scelta">
            {ricette.map((r) => (
              <li key={r.id}>
                <button onClick={() => scegli({ tipo: 'ricetta', ricetta: r })}>
                  <Miniatura ricetta={r} />
                  <span className="testi">
                    <span className="titolo">{r.titolo}</span>
                    <span className="dettagli">
                      Una porzione: <Sintesi valori={r} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {ricette.length === 0 && <p className="nota">Nessuna ricetta con questo nome o ingrediente.</p>}
        </>
      )}

      {scheda === 'alimenti' && (
        <>
          <ul className="ricette scelta semplice">
            {alimenti.map((i) => (
              <li key={i.id}>
                <button onClick={() => scegli({ tipo: 'alimento', alimento: i })}>
                  <span className="icona-alimento" aria-hidden="true">
                    {i.icona}
                  </span>
                  <span className="testi">
                    <span className="titolo">{i.nome.charAt(0).toUpperCase() + i.nome.slice(1)}</span>
                    <span className="dettagli">
                      Per 100 {i.unita_base === 'ml' ? 'ml' : 'g'}:{' '}
                      <Sintesi
                        valori={{ kcal: i.kcal_100, proteine_g: i.proteine_100, carboidrati_g: i.carboidrati_100, grassi_g: i.grassi_100 }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {alimenti.length === 0 && (
            <p className="nota">Nessun alimento con questo nome. Puoi aggiungerlo dalla scheda «A mano» scrivendo calorie e macronutrienti.</p>
          )}
        </>
      )}

      {scheda === 'mano' && (
        <form className="modulo" onSubmit={aMano}>
          <label htmlFor="nome-mano">Cosa hai mangiato</label>
          <input id="nome-mano" placeholder="Pizza margherita, barretta…" value={nome} onChange={(e) => setNome(e.target.value)} />
          <p className="nota">Valori di quello che hai mangiato. Lascia vuoto quello che non conosci.</p>
          <CampiValori id="mano" testi={testi} cambia={setTesti} />
          <button type="submit" disabled={attesa || !nome.trim()}>
            {attesa ? 'Salvataggio…' : `Aggiungi a ${nomePasto}`}
          </button>
        </form>
      )}
    </main>
  );
}
