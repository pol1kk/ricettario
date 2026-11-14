import { supabase } from './supabase';

export type Pasto = 'colazione' | 'pranzo' | 'cena';
export const PASTI: { valore: Pasto; nome: string }[] = [
  { valore: 'colazione', nome: 'Colazione' },
  { valore: 'pranzo', nome: 'Pranzo' },
  { valore: 'cena', nome: 'Cena' },
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

/** Il pasto più probabile a quest'ora, per precompilare le scelte. */
export function pastoDiAdesso(): Pasto {
  const ora = new Date().getHours();
  return ora < 11 ? 'colazione' : ora < 16 ? 'pranzo' : 'cena';
}

/** "2 porzioni", "1 porzione", "1,5 porzioni" */
export const nomePorzioni = (n: number) =>
  `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })} ${n === 1 ? 'porzione' : 'porzioni'}`;
