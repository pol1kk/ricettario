import { formattaValore } from '../lib/dati';
import { CAMPI_VALORI, NOMI_VALORI, type CampoValore, type Valori } from '../lib/diario';

/** "450 kcal, P 30, C 40, G 12", con le sigle nei colori dei macronutrienti. */
export function Sintesi({ valori }: { valori: Valori }) {
  const presenti = CAMPI_VALORI.filter((c) => valori[c] !== null);
  if (presenti.length === 0) return <span className="sintesi">valori non indicati</span>;
  return (
    <span className="sintesi">
      {presenti.map((c) => (
        <span key={c} data-macro={c}>
          {c === 'kcal' ? `${Math.round(valori[c]!).toLocaleString('it-IT', { useGrouping: 'always' })} kcal` : `${NOMI_VALORI[c].sigla} ${formattaValore(valori[c]!)}`}
        </span>
      ))}
    </span>
  );
}

export type TestiValori = Record<CampoValore, string>;
export const TESTI_VUOTI: TestiValori = { kcal: '', proteine_g: '', carboidrati_g: '', grassi_g: '' };

export const inTesti = (v: Partial<Valori>): TestiValori => ({
  kcal: v.kcal == null ? '' : String(v.kcal).replace('.', ','),
  proteine_g: v.proteine_g == null ? '' : String(v.proteine_g).replace('.', ','),
  carboidrati_g: v.carboidrati_g == null ? '' : String(v.carboidrati_g).replace('.', ','),
  grassi_g: v.grassi_g == null ? '' : String(v.grassi_g).replace('.', ','),
});

/** I quattro campi di calorie e macronutrienti, usati per le voci a mano e per gli obiettivi. */
export function CampiValori({ id, testi, cambia }: { id: string; testi: TestiValori; cambia: (t: TestiValori) => void }) {
  return (
    <div className="quattro-campi">
      {CAMPI_VALORI.map((c) => (
        <div key={c} data-macro={c}>
          <label htmlFor={`${id}-${c}`}>{NOMI_VALORI[c].nome}</label>
          <span className="campo-unita">
            <input id={`${id}-${c}`} inputMode="decimal" value={testi[c]} onChange={(e) => cambia({ ...testi, [c]: e.target.value })} />
            <span>{NOMI_VALORI[c].unita}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
