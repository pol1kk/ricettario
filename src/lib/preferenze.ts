// Preferenze per comporre il menù. Quelle della casa sono una serie sola, modificabile da tutti;
// quelle personali le scrive solo l'interessato ma le leggono tutti i membri, perché il menù comune
// deve andare bene a ognuno. Ogni preferenza è facoltativa: se manca, quel criterio non si applica.
import { supabase } from './supabase';
import type { Obiettivi } from './diario';
import type { Pasto } from './piano';

export type QuandoPasto = 'sempre' | 'feriali' | 'weekend' | 'mai';

export type PreferenzeCasa = {
  /** vero dopo che qualcuno ha compilato il questionario: da allora "Proponi settimana" parte subito */
  compilate?: boolean;
  /** quando pianificare ogni pasto; se manca vale 'sempre' */
  pasti?: Partial<Record<Pasto, QuandoPasto>>;
  /** per quante persone si cucinano i pasti comuni */
  persone?: number | null;
  minuti_feriali?: number | null;
  minuti_weekend?: number | null;
  /** quante volte al massimo la stessa ricetta in una settimana; null = nessun limite */
  max_ripetizioni?: number | null;
  /** "cucino una volta per due pasti": la cena diventa il pranzo del giorno dopo */
  avanzi?: boolean;
  /** quanti sgarri a settimana (pasti comuni sfiziosi, senza guardare gli obiettivi) */
  sgarri?: number;
  /** in quali giorni (1 = lunedì … 7 = domenica); vuoto = sceglie l'app */
  giorni_sgarro?: number[];
  /** dare la precedenza a quello che c'è in dispensa e a ciò che scade; se manca vale vero */
  dispensa?: boolean;
};

/** "Al massimo `max` volte a settimana" per un ingrediente o per un gruppo; 0 = mai. */
export type Limite = { tipo: 'ingrediente' | 'gruppo'; id: string; max: number };

export type PreferenzePersona = {
  /** id dei tag che piacciono e di quelli da evitare */
  tag_si?: string[];
  tag_no?: string[];
  limiti?: Limite[];
  /** rispettare i propri obiettivi di calorie e macronutrienti; se manca vale vero */
  obiettivi?: boolean;
};

export const GRUPPI: { id: string; nome: string }[] = [
  { id: 'carne_rossa', nome: 'Carne rossa' },
  { id: 'carne_bianca', nome: 'Carne bianca' },
  { id: 'pesce', nome: 'Pesce' },
  { id: 'uova', nome: 'Uova' },
  { id: 'latticini', nome: 'Latticini' },
  { id: 'legumi', nome: 'Legumi' },
];

export async function leggiPreferenzeCasa(casaId: string): Promise<PreferenzeCasa> {
  const { data, error } = await supabase.from('preferenze_casa').select('dati').eq('casa_id', casaId).limit(1);
  if (error) throw new Error(error.message);
  return ((data?.[0] as { dati: PreferenzeCasa } | undefined)?.dati ?? {}) as PreferenzeCasa;
}

export async function salvaPreferenzeCasa(casaId: string, dati: PreferenzeCasa): Promise<void> {
  const { error } = await supabase.from('preferenze_casa').upsert({ casa_id: casaId, dati, aggiornato_il: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Preferenze personali di tutti i membri della casa: id utente -> preferenze. */
export async function leggiPreferenzePersone(casaId: string): Promise<Record<string, PreferenzePersona>> {
  const { data, error } = await supabase.from('preferenze_persona').select('utente_id, dati').eq('casa_id', casaId);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as { utente_id: string; dati: PreferenzePersona }[]).map((r) => [r.utente_id, r.dati ?? {}]));
}

export async function salvaPreferenzePersona(casaId: string, utente: string, dati: PreferenzePersona): Promise<void> {
  const { error } = await supabase
    .from('preferenze_persona')
    .upsert({ casa_id: casaId, utente_id: utente, dati, aggiornato_il: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Obiettivi di tutte le persone della casa (solo per il calcolo del menù): id utente -> obiettivi. */
export async function leggiObiettiviCasa(casaId: string): Promise<Record<string, Obiettivi>> {
  const { data, error } = await supabase.rpc('obiettivi_casa', { p_casa: casaId });
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    ((data ?? []) as ({ utente_id: string } & Obiettivi)[]).map((r) => [r.utente_id, { fissi: r.fissi, settimana: r.settimana ?? {}, giorni: r.giorni ?? {} }]),
  );
}
