import { useEffect, useState } from 'react';
import { leggiCache, scriviCache } from '../lib/dati';
import { CAMPI_VALORI, OBIETTIVI_VUOTI, leggiNumero, leggiObiettivi, salvaObiettivi, type Obiettivi as Mete, type Valori } from '../lib/diario';
import { tornaAlDiario } from '../lib/rotta';
import { CampiValori, Sintesi, TESTI_VUOTI, inTesti, type TestiValori } from './ValoriDiario';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const CHIAVI = ['1', '2', '3', '4', '5', '6', '7'];

const inValori = (t: TestiValori): Partial<Valori> => {
  const v: Partial<Valori> = {};
  for (const c of CAMPI_VALORI) {
    const n = leggiNumero(t[c]);
    if (n !== null) v[c] = n;
  }
  return v;
};
const pieno = (t: TestiValori) => CAMPI_VALORI.some((c) => t[c].trim() !== '');

type Modulo = { fissi: boolean; settimana: TestiValori; giorni: Record<string, TestiValori> };

const inModulo = (o: Mete): Modulo => ({
  fissi: o.fissi,
  settimana: inTesti(o.settimana),
  giorni: Object.fromEntries(CHIAVI.map((k) => [k, inTesti(o.giorni[k] ?? {})])),
});

export default function Obiettivi({ utente }: { utente: string }) {
  const [modulo, setModulo] = useState<Modulo>(() => inModulo(leggiCache<Mete>(`obiettivi.${utente}`) ?? OBIETTIVI_VUOTI));
  const [toccato, setToccato] = useState(false);
  const [aperto, setAperto] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    leggiObiettivi().then(
      (o) => setModulo((prima) => (toccato ? prima : inModulo(o))),
      () => setErrore('Senza connessione: vedi gli obiettivi salvati l’ultima volta e non puoi modificarli.'),
    );
    // si legge una volta sola, all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambia = (m: Modulo) => {
    setModulo(m);
    setToccato(true);
  };

  function alterna(fissi: boolean) {
    const m = { ...modulo, fissi };
    // passando da un modo all'altro si parte dai valori già scritti, per non doverli ricopiare
    if (fissi && !pieno(m.settimana)) {
      const primo = CHIAVI.map((k) => m.giorni[k]).find(pieno);
      if (primo) m.settimana = { ...primo };
    }
    if (!fissi && pieno(m.settimana) && !CHIAVI.some((k) => pieno(m.giorni[k]))) {
      m.giorni = Object.fromEntries(CHIAVI.map((k) => [k, { ...m.settimana }]));
    }
    cambia(m);
  }

  async function salva() {
    setAttesa(true);
    setErrore(null);
    const o: Mete = {
      fissi: modulo.fissi,
      settimana: inValori(modulo.settimana),
      giorni: Object.fromEntries(CHIAVI.map((k) => [k, inValori(modulo.giorni[k])])),
    };
    try {
      await salvaObiettivi(utente, o);
      scriviCache(`obiettivi.${utente}`, o);
      tornaAlDiario();
    } catch (e) {
      setErrore(`Obiettivi non salvati: ${(e as Error).message}. Controlla la connessione e riprova.`);
      setAttesa(false);
    }
  }

  return (
    <main className="obiettivi">
      <button className="indietro secondario" onClick={tornaAlDiario}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Diario
      </button>
      <header className="ricetta-testa">
        <h1>Obiettivi</h1>
        <p className="origine">Calorie e macronutrienti al giorno. Sono solo tuoi; lascia vuoto quello che non ti interessa.</p>
      </header>

      <label className="spunta interruttore">
        <input type="checkbox" checked={modulo.fissi} onChange={(e) => alterna(e.target.checked)} />
        Uguali per tutta la settimana
      </label>

      {modulo.fissi ? (
        <section className="obiettivo-unico">
          <CampiValori id="sett" testi={modulo.settimana} cambia={(t) => cambia({ ...modulo, settimana: t })} />
        </section>
      ) : (
        <div className="obiettivi-giorni">
          {CHIAVI.map((k, n) => {
            const t = modulo.giorni[k] ?? TESTI_VUOTI;
            return (
              <div key={k} className="pasto-voce">
                <button className="riga-voce" aria-expanded={aperto === k} onClick={() => setAperto(aperto === k ? null : k)}>
                  <span className="titolo">{GIORNI[n]}</span>
                  <span className="dettagli">
                    {pieno(t) ? <Sintesi valori={{ kcal: null, proteine_g: null, carboidrati_g: null, grassi_g: null, ...inValori(t) }} /> : 'Nessun obiettivo'}
                  </span>
                </button>
                {aperto === k && (
                  <div className="pannello-voce">
                    <CampiValori id={`g${k}`} testi={t} cambia={(nuovi) => cambia({ ...modulo, giorni: { ...modulo.giorni, [k]: nuovi } })} />
                    <div className="comandi">
                      <button
                        type="button"
                        className="contorno"
                        disabled={!pieno(t)}
                        onClick={() => cambia({ ...modulo, giorni: Object.fromEntries(CHIAVI.map((x) => [x, { ...t }])) })}
                      >
                        Copia su tutti i giorni
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
      <button className="salva-obiettivi" disabled={attesa} onClick={salva}>
        {attesa ? 'Salvataggio…' : 'Salva gli obiettivi'}
      </button>
    </main>
  );
}
