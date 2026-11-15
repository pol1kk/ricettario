import { supabase } from './supabase';
import { daIso, iso, oggi } from './date';
import type { Ingrediente, Unita } from './dati';

export type Posizione = 'dispensa' | 'frigo' | 'freezer';
export const POSIZIONI: { valore: Posizione; nome: string }[] = [
  { valore: 'dispensa', nome: 'Dispensa' },
  { valore: 'frigo', nome: 'Frigo' },
  { valore: 'freezer', nome: 'Freezer' },
];
export type StatoScorta = 'presente' | 'sta_finendo' | 'finito';

/** Una confezione in dispensa. */
export type Confezione = {
  id: string;
  ingrediente_id: string;
  prodotto_id: string | null;
  quantita: number | null;
  stato: StatoScorta | null;
  scadenza: string | null;
  posizione: Posizione;
  prodotti: { nome: string; marca: string | null } | null;
};

export type Prodotto = {
  id: string;
  codice_barre: string;
  nome: string;
  marca: string | null;
  formato_quantita: number | null;
  formato_unita: Unita | null;
  ingrediente_id: string;
  posizione_predefinita: Posizione;
};

const CAMPI = 'id, ingrediente_id, prodotto_id, quantita, stato, scadenza, posizione, prodotti ( nome, marca )';
const CAMPI_PRODOTTO = 'id, codice_barre, nome, marca, formato_quantita, formato_unita, ingrediente_id, posizione_predefinita';

export async function leggiDispensa(casaId: string): Promise<Confezione[]> {
  const { data, error } = await supabase.from('dispensa').select(CAMPI).eq('casa_id', casaId).is('esaurita_il', null).order('aggiunto_il');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Confezione[];
}

export type NuovaConfezione = {
  ingrediente_id: string;
  prodotto_id?: string | null;
  quantita?: number | null;
  scadenza?: string | null;
  posizione: Posizione;
  confezioni?: number;
  /** voce della lista della spesa da togliere insieme */
  voce_lista?: string | null;
};

export async function mettiInDispensa(casaId: string, c: NuovaConfezione): Promise<void> {
  const { error } = await supabase.rpc('metti_in_dispensa', { p_casa: casaId, p: c });
  if (error) throw new Error(error.message);
}

export async function modificaConfezione(
  id: string,
  campi: Partial<Pick<Confezione, 'quantita' | 'stato' | 'scadenza' | 'posizione'>>,
): Promise<void> {
  const { error } = await supabase.from('dispensa').update(campi).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function chiudiConfezione(id: string, motivo: 'uso' | 'buttato'): Promise<void> {
  const { error } = await supabase.rpc('chiudi_confezione', { p_dispensa: id, p_motivo: motivo });
  if (error) throw new Error(error.message);
}

// ---------- prodotti e codici a barre ----------

export type DatiProdotto = {
  nome: string;
  marca: string | null;
  formato_quantita: number | null;
  formato_unita: 'g' | 'ml' | null;
  kcal_100: number | null;
  proteine_100: number | null;
  carboidrati_100: number | null;
  grassi_100: number | null;
};

export async function cercaProdotto(casaId: string, codice: string): Promise<Prodotto | null> {
  const { data, error } = await supabase.from('prodotti').select(CAMPI_PRODOTTO).eq('casa_id', casaId).eq('codice_barre', codice).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as Prodotto | undefined) ?? null;
}

export async function salvaProdotto(casaId: string, codice: string, ingredienteId: string, d: DatiProdotto, posizione: Posizione): Promise<Prodotto> {
  const { data, error } = await supabase
    .from('prodotti')
    .insert({ casa_id: casaId, codice_barre: codice, ingrediente_id: ingredienteId, posizione_predefinita: posizione, ...d })
    .select(CAMPI_PRODOTTO)
    .single();
  if (error) throw new Error(error.message);
  return data as Prodotto;
}

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** "500 g", "1 kg", "75 cl", "1,5 L" -> quantità in grammi o millilitri */
export function leggiFormato(testo: string): { quantita: number; unita: 'g' | 'ml' } | null {
  const m = testo.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const [fattore, unita] = ({ kg: [1000, 'g'], g: [1, 'g'], l: [1000, 'ml'], cl: [10, 'ml'], ml: [1, 'ml'] } as const)[m[2] as 'kg'];
  return n > 0 ? { quantita: Math.round(n * fattore), unita } : null;
}

/**
 * Cerca un codice a barre su Open Food Facts (archivio pubblico e gratuito).
 * null se il prodotto non c'è; lancia un errore se manca la connessione.
 */
export async function cercaSuOpenFoodFacts(codice: string): Promise<DatiProdotto | null> {
  const campi = 'product_name,product_name_it,generic_name_it,brands,quantity,product_quantity,product_quantity_unit,nutriments';
  const risposta = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codice)}.json?fields=${campi}`);
  if (risposta.status === 404) return null;
  if (!risposta.ok) throw new Error(`Open Food Facts non risponde (${risposta.status})`);
  const json = (await risposta.json()) as { status?: number; product?: Record<string, unknown> };
  const p = json.product;
  if (json.status !== 1 || !p) return null;
  const nome = String(p.product_name_it || p.product_name || p.generic_name_it || '').trim();
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const quantita = numero(p.product_quantity);
  const unita = String(p.product_quantity_unit ?? '').toLowerCase();
  const formato =
    quantita && (unita === 'g' || unita === 'ml') ? { quantita, unita: unita as 'g' | 'ml' } : leggiFormato(String(p.quantity ?? ''));
  return {
    nome,
    marca: String(p.brands ?? '').split(',')[0].trim() || null,
    formato_quantita: formato?.quantita ?? null,
    formato_unita: formato?.unita ?? null,
    kcal_100: numero(n['energy-kcal_100g']),
    proteine_100: numero(n.proteins_100g),
    carboidrati_100: numero(n.carbohydrates_100g),
    grassi_100: numero(n.fat_100g),
  };
}

// ---------- ingredienti nuovi ----------

export async function creaIngrediente(
  casaId: string,
  i: { nome: string; unita_base: Unita; reparto_id: string | null; valori?: Partial<DatiProdotto> },
): Promise<string> {
  const { data, error } = await supabase
    .from('ingredienti')
    .insert({
      casa_id: casaId,
      nome: i.nome.trim().toLowerCase(),
      unita_base: i.unita_base,
      reparto_id: i.reparto_id,
      // i valori del prodotto valgono per l'ingrediente solo se si misurano allo stesso modo (a peso o a volume)
      ...(i.unita_base !== 'unita' && i.valori
        ? {
            kcal_100: i.valori.kcal_100 ?? null,
            proteine_100: i.valori.proteine_100 ?? null,
            carboidrati_100: i.valori.carboidrati_100 ?? null,
            grassi_100: i.valori.grassi_100 ?? null,
          }
        : {}),
    })
    .select('id')
    .single();
  if (error) throw new Error(error.code === '23505' ? 'Esiste già un ingrediente con questo nome.' : error.message);
  return (data as { id: string }).id;
}

/** Dove va di solito un ingrediente, dal suo reparto. */
export function posizioneAbituale(i: Ingrediente | undefined): Posizione {
  const reparto = i?.reparto ?? '';
  if (reparto === 'Surgelati') return 'freezer';
  if (['Latticini e uova', 'Carne e pesce', 'Frutta e verdura', 'Proteine vegetali'].includes(reparto)) return 'frigo';
  return 'dispensa';
}

// ---------- scadenze ----------

/** "2027-03-05" -> "05/03/2027" */
export function formattaData(s: string): string {
  const [a, m, g] = s.split('-');
  return `${g}/${m}/${a}`;
}

/** Mentre si scrive: tiene solo le cifre e mette le barre da solo ("0503" -> "05/03"). */
export function mascheraData(testo: string): string {
  const cifre = testo.replace(/\D/g, '').slice(0, 8);
  return [cifre.slice(0, 2), cifre.slice(2, 4), cifre.slice(4)].filter(Boolean).join('/');
}

/**
 * Legge una data scritta come gg/mm/aaaa, gg/mm/aa o gg/mm (in quel caso l'anno è quello della
 * prossima volta che cade quel giorno). Restituisce la data, null se vuoto, 'errore' se non valida.
 */
export function leggiData(testo: string): string | null | 'errore' {
  const cifre = testo.replace(/\D/g, '');
  if (!cifre) return null;
  if (![4, 6, 8].includes(cifre.length)) return 'errore';
  const giorno = Number(cifre.slice(0, 2));
  const mese = Number(cifre.slice(2, 4));
  let anno: number;
  if (cifre.length === 4) {
    const ora = new Date();
    anno = ora.getFullYear();
    if (new Date(anno, mese - 1, giorno + 1) < ora) anno += 1;
  } else anno = cifre.length === 6 ? 2000 + Number(cifre.slice(4)) : Number(cifre.slice(4));
  const d = new Date(anno, mese - 1, giorno);
  if (d.getFullYear() !== anno || d.getMonth() !== mese - 1 || d.getDate() !== giorno || anno < 2020 || anno > 2100) return 'errore';
  return iso(d);
}

export const giorniAllaScadenza = (s: string) => Math.round((daIso(s).getTime() - daIso(oggi()).getTime()) / 86_400_000);

/** Testo e urgenza di una scadenza: 'scaduto', 'presto' (entro 3 giorni) oppure 'lontano'. */
export function descriviScadenza(s: string): { testo: string; urgenza: 'scaduto' | 'presto' | 'lontano' } {
  const g = giorniAllaScadenza(s);
  if (g < 0) return { testo: g === -1 ? 'scaduto ieri' : `scaduto da ${-g} giorni`, urgenza: 'scaduto' };
  if (g === 0) return { testo: 'scade oggi', urgenza: 'presto' };
  if (g === 1) return { testo: 'scade domani', urgenza: 'presto' };
  if (g <= 3) return { testo: `scade tra ${g} giorni`, urgenza: 'presto' };
  return { testo: `scade il ${formattaData(s)}`, urgenza: 'lontano' };
}

// ---------- scarico ----------

/** Toglie dalla dispensa le quantità usate, partendo dalle confezioni che scadono prima. */
export async function scalaDispensa(
  casaId: string,
  ricettaId: string | null,
  righe: { ingrediente_id: string; quantita: number }[],
): Promise<void> {
  const { error } = await supabase.rpc('scala_dispensa', { p_casa: casaId, p: { ricetta_id: ricettaId, righe } });
  if (error) throw new Error(error.message);
}

/** Quanto c'è in tutto di ogni ingrediente a quantità, e la scadenza più vicina di ciascuno. */
export function riassumiDispensa(confezioni: Confezione[]): Map<string, { quantita: number; scadenza: string | null; presente: boolean }> {
  const totali = new Map<string, { quantita: number; scadenza: string | null; presente: boolean }>();
  for (const c of confezioni) {
    const t = totali.get(c.ingrediente_id) ?? { quantita: 0, scadenza: null, presente: false };
    t.quantita += c.quantita ?? 0;
    // un ingrediente a stato ("c'è", "sta finendo") è presente finché ha una riga aperta
    t.presente = true;
    if (c.scadenza && (!t.scadenza || c.scadenza < t.scadenza)) t.scadenza = c.scadenza;
    totali.set(c.ingrediente_id, t);
  }
  return totali;
}
