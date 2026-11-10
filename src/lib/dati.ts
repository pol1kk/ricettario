import { supabase } from './supabase';

export type Unita = 'g' | 'ml' | 'unita';
export type Tag = { id: string; nome: string; gruppo: string; ordine: number; automatico: boolean };
export type Passaggio = { testo: string; gruppo?: string };
export type IngredienteRicetta = {
  id: string;
  nome: string;
  quantita: number | null;
  unita: Unita | null;
  testo_originale: string | null;
  gruppo: string | null;
  facoltativo: boolean;
};
export type Ricetta = {
  id: string;
  titolo: string;
  autore: string | null;
  reel_url: string | null;
  porzioni: number;
  minuti_preparazione: number | null;
  minuti_cottura: number | null;
  minuti_totali: number | null;
  passaggi: Passaggio[];
  note: string | null;
  da_verificare: boolean;
  note_verifica: string | null;
  tag: Tag[];
  ingredienti: IngredienteRicetta[];
  /** testo minuscolo su cui gira la ricerca: titolo, autore e nomi degli ingredienti */
  cerca: string;
};
export type Dati = { casa: { nome: string } | null; tag: Tag[]; ricette: Ricetta[] };

type RigaRicetta = Omit<Ricetta, 'tag' | 'ingredienti' | 'cerca'> & {
  ricetta_tag: { tag_id: string }[];
  ricetta_ingredienti: (Omit<IngredienteRicetta, 'nome'> & { posizione: number; ingredienti: { nome: string } })[];
};

const semplifica = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export { semplifica };

export async function caricaDati(): Promise<Dati> {
  const [casa, tag, ricette] = await Promise.all([
    supabase.from('case').select('nome, soglia_veloce_minuti').limit(1),
    supabase.from('tag').select('id, nome, gruppo, ordine, automatico').order('ordine'),
    supabase
      .from('ricette')
      .select(
        `id, titolo, autore, reel_url, porzioni, minuti_preparazione, minuti_cottura, minuti_totali,
         passaggi, note, da_verificare, note_verifica,
         ricetta_tag ( tag_id ),
         ricetta_ingredienti ( id, quantita, unita, testo_originale, gruppo, facoltativo, posizione, ingredienti ( nome ) )`,
      )
      .order('titolo'),
  ]);
  const errore = casa.error ?? tag.error ?? ricette.error;
  if (errore) throw new Error(errore.message);

  const tutti = (tag.data ?? []) as Tag[];
  const perId = new Map(tutti.map((t) => [t.id, t]));
  const soglia: number = casa.data?.[0]?.soglia_veloce_minuti ?? 20;
  const veloce = tutti.find((t) => t.automatico && t.nome === 'veloce');

  const elenco = ((ricette.data ?? []) as unknown as RigaRicetta[]).map((r): Ricetta => {
    const { ricetta_tag, ricetta_ingredienti, ...resto } = r;
    const suoi = ricetta_tag.map((x) => perId.get(x.tag_id)).filter((t): t is Tag => !!t);
    // "veloce" non è assegnato a mano: vale per le ricette sotto la soglia di tempo della casa
    if (veloce && r.minuti_totali !== null && r.minuti_totali <= soglia) suoi.push(veloce);
    const ingredienti = [...ricetta_ingredienti]
      .sort((a, b) => a.posizione - b.posizione)
      .map(({ ingredienti, posizione: _p, ...i }) => ({ ...i, nome: ingredienti.nome }));
    return {
      ...resto,
      passaggi: Array.isArray(r.passaggi) ? r.passaggi : [],
      tag: suoi.sort((a, b) => a.ordine - b.ordine),
      ingredienti,
      cerca: semplifica([r.titolo, r.autore ?? '', ...ingredienti.map((i) => i.nome)].join(' ')),
    };
  });

  return { casa: casa.data?.[0] ? { nome: casa.data[0].nome } : null, tag: tutti, ricette: elenco };
}

/** "45 min", "2 h", "1 h 30 min" */
export function formattaMinuti(m: number | null): string | null {
  if (m === null) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

const numero = (v: number, decimali = 0) =>
  v.toLocaleString('it-IT', { maximumFractionDigits: decimali });

const FRAZIONI: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** Quantità di un ingrediente per le porzioni scelte. `fattore` = porzioni scelte / porzioni della ricetta. */
export function formattaQuantita(q: number | null, unita: Unita | null, fattore: number): string {
  if (q === null) return 'q.b.';
  const v = q * fattore;

  if (unita === 'unita' || unita === null) {
    const quarti = Math.max(1, Math.round(v * 4)) / 4;
    const interi = Math.floor(quarti);
    const frazione = FRAZIONI[quarti - interi] ?? '';
    return interi ? `${interi}${frazione ? ` ${frazione}` : ''}` : frazione;
  }

  // alle porzioni originali si mostra il valore della ricetta, senza arrotondamenti
  let arrotondato = v;
  if (fattore !== 1) {
    if (v < 20) arrotondato = Math.max(1, Math.round(v));
    else if (v < 100) arrotondato = Math.round(v / 5) * 5;
    else arrotondato = Math.round(v / 10) * 10;
  }
  if (arrotondato >= 1000) return `${numero(arrotondato / 1000, 2)} ${unita === 'g' ? 'kg' : 'l'}`;
  return `${numero(arrotondato, 1)} ${unita}`;
}
