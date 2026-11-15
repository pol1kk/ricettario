import { supabase } from './supabase';

export type Pasto = 'colazione' | 'merenda_mattino' | 'pranzo' | 'merenda_pomeriggio' | 'cena';
/** `breve` sta nella colonna stretta del menù; `tag` è il tag delle ricette più adatte a quel pasto. */
export const PASTI: { valore: Pasto; nome: string; breve: string; tag?: string }[] = [
  { valore: 'colazione', nome: 'Colazione', breve: 'Colazione', tag: 'colazione' },
  { valore: 'merenda_mattino', nome: 'Merenda del mattino', breve: 'Merenda', tag: 'snack' },
  { valore: 'pranzo', nome: 'Pranzo', breve: 'Pranzo' },
  { valore: 'merenda_pomeriggio', nome: 'Merenda del pomeriggio', breve: 'Merenda', tag: 'snack' },
  { valore: 'cena', nome: 'Cena', breve: 'Cena' },
];

export type VocePiano = {
  id: string;
  data: string;
  pasto: Pasto;
  ricetta_id: string | null;
  nota: string | null;
  porzioni: number | null;
  cucinata_il: string | null;
};

const CAMPI = 'id, data, pasto, ricetta_id, nota, porzioni, cucinata_il';

export async function leggiPiano(casaId: string, dal: string, al: string): Promise<VocePiano[]> {
  const { data, error } = await supabase
    .from('piano_pasti')
    .select(CAMPI)
    .eq('casa_id', casaId)
    .gte('data', dal)
    .lte('data', al)
    .order('creato_il');
  if (error) throw new Error(error.message);
  return (data ?? []) as VocePiano[];
}

export async function aggiungiAlPiano(
  casaId: string,
  voce: { data: string; pasto: Pasto; ricetta_id?: string; nota?: string; porzioni?: number; cucinata?: boolean },
): Promise<void> {
  const { error } = await supabase.from('piano_pasti').insert({
    casa_id: casaId,
    data: voce.data,
    pasto: voce.pasto,
    ricetta_id: voce.ricetta_id ?? null,
    nota: voce.nota ?? null,
    porzioni: voce.porzioni ?? null,
    cucinata_il: voce.cucinata ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
}

export async function modificaPiano(id: string, campi: Partial<Pick<VocePiano, 'porzioni' | 'cucinata_il'>>): Promise<void> {
  const { error } = await supabase.from('piano_pasti').update(campi).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function togliDalPiano(id: string): Promise<void> {
  const { error } = await supabase.from('piano_pasti').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Segna una ricetta come cucinata oggi. Se nel menù di oggi c'è già quella ricetta non ancora
 * cucinata, aggiorna quella voce invece di crearne una seconda. Restituisce il pasto usato.
 */
export async function segnaCucinataOggi(casaId: string, ricettaId: string, porzioni: number): Promise<Pasto> {
  const giorno = new Date();
  const data = `${giorno.getFullYear()}-${String(giorno.getMonth() + 1).padStart(2, '0')}-${String(giorno.getDate()).padStart(2, '0')}`;
  const adesso = new Date().toISOString();
  const prevista = await supabase
    .from('piano_pasti')
    .select('id, pasto')
    .eq('casa_id', casaId)
    .eq('ricetta_id', ricettaId)
    .eq('data', data)
    .is('cucinata_il', null)
    .order('creato_il')
    .limit(1);
  if (prevista.error) throw new Error(prevista.error.message);
  if (prevista.data?.length) {
    const voce = prevista.data[0] as { id: string; pasto: Pasto };
    await modificaPiano(voce.id, { porzioni, cucinata_il: adesso });
    return voce.pasto;
  }
  const pasto = pastoDiAdesso();
  await aggiungiAlPiano(casaId, { data, pasto, ricetta_id: ricettaId, porzioni, cucinata: true });
  return pasto;
}

/** Il pasto più probabile a quest'ora, per precompilare le scelte. */
export function pastoDiAdesso(): Pasto {
  const ora = new Date().getHours();
  return ora < 11 ? 'colazione' : ora < 16 ? 'pranzo' : 'cena';
}

/** "2 porzioni", "1 porzione", "1,5 porzioni" */
export const nomePorzioni = (n: number) =>
  `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })} ${n === 1 ? 'porzione' : 'porzioni'}`;
