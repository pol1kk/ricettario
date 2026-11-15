import { supabase } from './supabase';
import { daIso, iso } from './date';
import type { Ingrediente, Ricetta } from './dati';
import type { Pasto } from './piano';

export type Valori = {
  kcal: number | null;
  proteine_g: number | null;
  carboidrati_g: number | null;
  grassi_g: number | null;
};
export const CAMPI_VALORI = ['kcal', 'proteine_g', 'carboidrati_g', 'grassi_g'] as const;
export type CampoValore = (typeof CAMPI_VALORI)[number];
export const NOMI_VALORI: Record<CampoValore, { nome: string; sigla: string; unita: string }> = {
  kcal: { nome: 'Calorie', sigla: 'kcal', unita: 'kcal' },
  proteine_g: { nome: 'Proteine', sigla: 'P', unita: 'g' },
  carboidrati_g: { nome: 'Carboidrati', sigla: 'C', unita: 'g' },
  grassi_g: { nome: 'Grassi', sigla: 'G', unita: 'g' },
};
export const SENZA_VALORI: Valori = { kcal: null, proteine_g: null, carboidrati_g: null, grassi_g: null };

export type UnitaDiario = 'porzioni' | 'g' | 'ml' | 'unita';
export type VoceDiario = Valori & {
  id: string;
  data: string;
  pasto: Pasto;
  nome: string;
  ricetta_id: string | null;
  ingrediente_id: string | null;
  piano_id: string | null;
  quantita: number | null;
  unita: UnitaDiario | null;
};
export type NuovaVoce = Omit<VoceDiario, 'id'>;

const CAMPI = 'id, data, pasto, nome, ricetta_id, ingrediente_id, piano_id, quantita, unita, kcal, proteine_g, carboidrati_g, grassi_g';

export async function leggiDiario(dal: string, al: string): Promise<VoceDiario[]> {
  const { data, error } = await supabase.from('diario').select(CAMPI).gte('data', dal).lte('data', al).order('creato_il');
  if (error) throw new Error(error.message);
  return (data ?? []) as VoceDiario[];
}

/** Le ultime cose mangiate, senza ripetizioni, per riaggiungerle con un tocco. */
export async function leggiRecenti(): Promise<VoceDiario[]> {
  const { data, error } = await supabase.from('diario').select(CAMPI).order('creato_il', { ascending: false }).limit(150);
  if (error) throw new Error(error.message);
  const visti = new Set<string>();
  const recenti: VoceDiario[] = [];
  for (const v of (data ?? []) as VoceDiario[]) {
    const chiave = v.ricetta_id ?? v.ingrediente_id ?? v.nome.toLowerCase();
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    recenti.push(v);
    if (recenti.length === 20) break;
  }
  return recenti;
}

export async function aggiungiVoce(voce: NuovaVoce): Promise<void> {
  const { error } = await supabase.from('diario').insert(voce);
  if (error) throw new Error(error.message);
}

export async function modificaVoce(id: string, campi: Partial<NuovaVoce>): Promise<void> {
  const { error } = await supabase.from('diario').update(campi).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function eliminaVoce(id: string): Promise<void> {
  const { error } = await supabase.from('diario').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- obiettivi ----------

/** `giorni` ha chiavi da "1" (lunedì) a "7" (domenica); `settimana` vale per tutti i giorni quando `fissi` è vero. */
export type Obiettivi = { fissi: boolean; settimana: Partial<Valori>; giorni: Record<string, Partial<Valori>> };
export const OBIETTIVI_VUOTI: Obiettivi = { fissi: false, settimana: {}, giorni: {} };

export async function leggiObiettivi(): Promise<Obiettivi> {
  const { data, error } = await supabase.from('obiettivi').select('fissi, settimana, giorni').limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as Obiettivi | undefined) ?? OBIETTIVI_VUOTI;
}

export async function salvaObiettivi(utente: string, o: Obiettivi): Promise<void> {
  const { error } = await supabase
    .from('obiettivi')
    .upsert({ utente_id: utente, ...o, aggiornato_il: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** 1 = lunedì … 7 = domenica */
export const giornoSettimana = (data: string) => ((daIso(data).getDay() + 6) % 7) + 1;

export function obiettivoDel(o: Obiettivi, data: string): Valori {
  const scelto = (o.fissi ? o.settimana : o.giorni[String(giornoSettimana(data))]) ?? {};
  return { ...SENZA_VALORI, ...scelto };
}

export const haObiettivo = (v: Valori) => CAMPI_VALORI.some((c) => v[c] !== null);

// ---------- calcoli ----------

const arrotonda = (v: number, campo: CampoValore) => (campo === 'kcal' ? Math.round(v) : Math.round(v * 10) / 10);

export function moltiplica(v: Valori, fattore: number): Valori {
  const r = { ...SENZA_VALORI };
  for (const c of CAMPI_VALORI) r[c] = v[c] === null ? null : arrotonda(v[c] * fattore, c);
  return r;
}

/** Somma i valori delle voci; un valore mancante conta zero. */
export function somma(voci: Valori[]): Record<CampoValore, number> {
  const t = { kcal: 0, proteine_g: 0, carboidrati_g: 0, grassi_g: 0 };
  for (const v of voci) for (const c of CAMPI_VALORI) t[c] += v[c] ?? 0;
  return t;
}

export const valoriRicetta = (r: Ricetta, porzioni: number): Valori =>
  moltiplica({ kcal: r.kcal, proteine_g: r.proteine_g, carboidrati_g: r.carboidrati_g, grassi_g: r.grassi_g }, porzioni);

/**
 * Peso di una porzione, sommando gli ingredienti a crudo (esclusa l'acqua e quelli senza quantità).
 * Serve per registrare una ricetta in grammi; null se non si riesce a stimarlo.
 */
export function pesoPorzione(r: Ricetta, catalogo: Map<string, Ingrediente>): number | null {
  let peso = 0;
  for (const i of r.ingredienti) {
    if (i.quantita === null || i.facoltativo || i.nome === 'acqua') continue;
    if (i.unita === 'unita') {
      const pezzo = catalogo.get(i.ingrediente_id)?.grammi_per_unita;
      if (!pezzo) continue;
      peso += i.quantita * pezzo;
    } else peso += i.quantita;
  }
  return peso > 0 && r.porzioni > 0 ? Math.round(peso / r.porzioni) : null;
}

/** Valori di un alimento del catalogo per la quantità data (grammi, millilitri o pezzi). */
export function valoriAlimento(i: Ingrediente, quantita: number): Valori {
  const peso = i.unita_base === 'unita' ? quantita * (i.grammi_per_unita ?? 0) : quantita;
  return moltiplica(
    { kcal: i.kcal_100, proteine_g: i.proteine_100, carboidrati_g: i.carboidrati_100, grassi_g: i.grassi_100 },
    peso / 100,
  );
}

/** "1 porzione", "150 g", "2 pezzi" */
export function nomeQuantita(q: number, unita: UnitaDiario): string {
  const n = q.toLocaleString('it-IT', { maximumFractionDigits: 2 });
  if (unita === 'porzioni') return `${n} ${q === 1 ? 'porzione' : 'porzioni'}`;
  if (unita === 'unita') return `${n} ${q === 1 ? 'pezzo' : 'pezzi'}`;
  return `${n} ${unita}`;
}

/** Numero scritto all'italiana ("1,5") -> numero; null se vuoto o non valido. */
export function leggiNumero(testo: string): number | null {
  const pulito = testo.trim().replace(',', '.');
  if (!pulito) return null;
  const n = Number(pulito);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Il pasto più probabile a quest'ora, tra i cinque del diario. */
export function pastoDiarioDiAdesso(): Pasto {
  const d = new Date();
  const ora = d.getHours() + d.getMinutes() / 60;
  return ora < 10.5 ? 'colazione' : ora < 12 ? 'merenda_mattino' : ora < 15.5 ? 'pranzo' : ora < 18.5 ? 'merenda_pomeriggio' : 'cena';
}

export const dataDiOggi = () => iso(new Date());
