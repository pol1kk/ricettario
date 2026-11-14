import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Ricetta, Tag } from '../lib/dati';

const intero = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))));
const decimale = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(v) || v <= 0 ? null : v;
};

const nonNegativo = (s: string) => {
  const v = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
};

const CAMPI_VALORI = [
  ['kcal', 'Calorie', 'kcal'],
  ['proteine_g', 'Proteine', 'g'],
  ['carboidrati_g', 'Carboidrati', 'g'],
  ['grassi_g', 'Grassi', 'g'],
] as const;

export default function ModificaRicetta({
  ricetta,
  tag,
  chiudi,
  ricarica,
}: {
  ricetta: Ricetta;
  tag: Tag[];
  chiudi: () => void;
  ricarica: () => Promise<void>;
}) {
  const [titolo, setTitolo] = useState(ricetta.titolo);
  const [porzioni, setPorzioni] = useState(String(ricetta.porzioni));
  const [preparazione, setPreparazione] = useState(ricetta.minuti_preparazione?.toString() ?? '');
  const [cottura, setCottura] = useState(ricetta.minuti_cottura?.toString() ?? '');
  const [scelti, setScelti] = useState(() => new Set(ricetta.tag.filter((t) => !t.automatico).map((t) => t.id)));
  const [quantita, setQuantita] = useState(() =>
    Object.fromEntries(ricetta.ingredienti.map((i) => [i.id, i.quantita?.toString().replace('.', ',') ?? ''])),
  );
  const [valori, setValori] = useState(() => ({
    kcal: ricetta.kcal?.toString().replace('.', ',') ?? '',
    proteine_g: ricetta.proteine_g?.toString().replace('.', ',') ?? '',
    carboidrati_g: ricetta.carboidrati_g?.toString().replace('.', ',') ?? '',
    grassi_g: ricetta.grassi_g?.toString().replace('.', ',') ?? '',
  }));
  const [verificata, setVerificata] = useState(false);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const gruppi = [...new Set(tag.map((t) => t.gruppo))];

  async function salva(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const { error } = await supabase.rpc('correggi_ricetta', {
      p_ricetta: ricetta.id,
      p: {
        titolo,
        porzioni: decimale(porzioni) ?? ricetta.porzioni,
        minuti_preparazione: intero(preparazione),
        minuti_cottura: intero(cottura),
        ...(verificata ? { da_verificare: false } : {}),
        tag: [...scelti],
        valori: {
          kcal: nonNegativo(valori.kcal),
          proteine_g: nonNegativo(valori.proteine_g),
          carboidrati_g: nonNegativo(valori.carboidrati_g),
          grassi_g: nonNegativo(valori.grassi_g),
        },
        quantita: ricetta.ingredienti.map((i) => ({ id: i.id, quantita: decimale(quantita[i.id] ?? '') })),
      },
    });
    if (error) {
      setAttesa(false);
      setErrore(`Modifiche non salvate: ${error.message}`);
      return;
    }
    await ricarica();
    chiudi();
  }

  return (
    <main className="modifica">
      <form onSubmit={salva} className="modulo">
        <h1>Correggi la ricetta</h1>

        <label htmlFor="m-titolo">Titolo</label>
        <input id="m-titolo" required value={titolo} onChange={(e) => setTitolo(e.target.value)} />

        <div className="tre-campi">
          <div>
            <label htmlFor="m-porzioni">Porzioni</label>
            <input id="m-porzioni" inputMode="decimal" required value={porzioni} onChange={(e) => setPorzioni(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m-prep">Preparazione</label>
            <input id="m-prep" inputMode="numeric" placeholder="min" value={preparazione} onChange={(e) => setPreparazione(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m-cottura">Cottura</label>
            <input id="m-cottura" inputMode="numeric" placeholder="min" value={cottura} onChange={(e) => setCottura(e.target.value)} />
          </div>
        </div>

        <h2>Valori nutrizionali</h2>
        <p className="nota">Per una porzione. Lascia vuoto quello che non conosci.</p>
        <div className="quattro-campi">
          {CAMPI_VALORI.map(([campo, etichetta, unita]) => (
            <div key={campo}>
              <label htmlFor={`m-${campo}`}>{etichetta}</label>
              <span className="campo-unita">
                <input
                  id={`m-${campo}`}
                  inputMode="decimal"
                  value={valori[campo]}
                  onChange={(e) => setValori({ ...valori, [campo]: e.target.value })}
                />
                <span>{unita}</span>
              </span>
            </div>
          ))}
        </div>

        <h2>Tag</h2>
        {gruppi.map((g) => (
          <fieldset key={g} className="scelta-tag">
            <legend>{g}</legend>
            {tag
              .filter((t) => t.gruppo === g && !t.automatico)
              .map((t) => (
                <label key={t.id} className="spunta">
                  <input
                    type="checkbox"
                    checked={scelti.has(t.id)}
                    onChange={() => {
                      const nuovo = new Set(scelti);
                      if (!nuovo.delete(t.id)) nuovo.add(t.id);
                      setScelti(nuovo);
                    }}
                  />
                  <span>{t.nome}</span>
                </label>
              ))}
          </fieldset>
        ))}

        <h2>Quantità</h2>
        <p className="nota">Per {porzioni || ricetta.porzioni} porzioni. Lascia vuoto per «quanto basta».</p>
        <ul className="quantita">
          {ricetta.ingredienti.map((i) => (
            <li key={i.id}>
              <label htmlFor={`q-${i.id}`}>
                {i.nome}
                {i.testo_originale && <small>{i.testo_originale}</small>}
              </label>
              <span className="campo-unita">
                <input
                  id={`q-${i.id}`}
                  inputMode="decimal"
                  placeholder="q.b."
                  value={quantita[i.id] ?? ''}
                  onChange={(e) => setQuantita({ ...quantita, [i.id]: e.target.value })}
                />
                <span>{i.unita === 'unita' ? 'pz' : (i.unita ?? '')}</span>
              </span>
            </li>
          ))}
        </ul>

        {ricetta.da_verificare && (
          <label className="spunta verificata">
            <input type="checkbox" checked={verificata} onChange={(e) => setVerificata(e.target.checked)} />
            <span>Ho controllato le quantità: togli «Da verificare»</span>
          </label>
        )}

        {errore && (
          <p role="alert" className="errore">
            {errore}
          </p>
        )}

        <div className="azioni">
          <button type="submit" disabled={attesa}>
            {attesa ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
          <button type="button" className="secondario" onClick={chiudi} disabled={attesa}>
            Annulla
          </button>
        </div>
      </form>
    </main>
  );
}
