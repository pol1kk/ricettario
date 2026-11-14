import { supabase } from './supabase';

export type Unita = 'g' | 'ml' | 'unita';
export type Tag = { id: string; nome: string; gruppo: string; ordine: number; automatico: boolean };
export type Passaggio = { testo: string; gruppo?: string };
export type IngredienteRicetta = {
  id: string;
  ingrediente_id: string;
  /** ingrediente di base (olio, sale, spezie, salse): non entra da solo nella lista della spesa */
  base: boolean;
  nome: string;
  icona: string | null;
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
  /** valori nutrizionali per porzione; null se il reel non li dichiara e non sono stati stimati */
  kcal: number | null;
  proteine_g: number | null;
  carboidrati_g: number | null;
  grassi_g: number | null;
  valori_fonte: 'dichiarati' | 'stimati' | null;
  copertina_path: string | null;
  /** indirizzo temporaneo della foto, valido un giorno; null se non c'è foto */
  copertina_url: string | null;
  tag: Tag[];
  ingredienti: IngredienteRicetta[];
  /** testo minuscolo su cui gira la ricerca: titolo, autore e nomi degli ingredienti */
  cerca: string;
};
export type Casa = { id: string; nome: string; soglia_veloce_minuti: number; porzioni_predefinite: number };
export type Ingrediente = {
  id: string;
  nome: string;
  icona: string | null;
  base: boolean;
  reparto: string | null;
  ordine_reparto: number;
};
export type Dati = { casa: Casa | null; tag: Tag[]; ricette: Ricetta[]; ingredienti: Ingrediente[] };

type RigaRicetta = Omit<Ricetta, 'tag' | 'ingredienti' | 'cerca' | 'copertina_url'> & {
  ricetta_tag: { tag_id: string }[];
  ricetta_ingredienti: (Omit<IngredienteRicetta, 'nome' | 'icona' | 'base'> & {
    posizione: number;
    ingredienti: { nome: string; icona: string | null; tracciamento: 'quantita' | 'stato' };
  })[];
};

const semplifica = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export { semplifica };

export async function caricaDati(): Promise<Dati> {
  const [casa, tag, ricette, catalogo] = await Promise.all([
    supabase.from('case').select('id, nome, soglia_veloce_minuti, porzioni_predefinite').limit(1),
    supabase.from('tag').select('id, nome, gruppo, ordine, automatico').order('ordine'),
    supabase
      .from('ricette')
      .select(
        `id, titolo, autore, reel_url, porzioni, minuti_preparazione, minuti_cottura, minuti_totali,
         passaggi, note, da_verificare, note_verifica, copertina_path,
         kcal, proteine_g, carboidrati_g, grassi_g, valori_fonte,
         ricetta_tag ( tag_id ),
         ricetta_ingredienti ( id, ingrediente_id, quantita, unita, testo_originale, gruppo, facoltativo, posizione,
                               ingredienti ( nome, icona, tracciamento ) )`,
      )
      .order('titolo'),
    supabase.from('ingredienti').select('id, nome, icona, tracciamento, reparti ( nome, ordine )').order('nome'),
  ]);
  const errore = casa.error ?? tag.error ?? ricette.error ?? catalogo.error;
  if (errore) throw new Error(errore.message);

  const tutti = (tag.data ?? []) as Tag[];
  const perId = new Map(tutti.map((t) => [t.id, t]));
  const soglia: number = casa.data?.[0]?.soglia_veloce_minuti ?? 20;
  const veloce = tutti.find((t) => t.automatico);

  const righe = (ricette.data ?? []) as unknown as RigaRicetta[];

  // le foto stanno in uno spazio privato: si leggono con indirizzi firmati, chiesti tutti insieme
  const percorsi = righe.map((r) => r.copertina_path).filter((p): p is string => !!p);
  const indirizzi = new Map<string, string>();
  if (percorsi.length) {
    const firmati = await supabase.storage.from('copertine').createSignedUrls(percorsi, 60 * 60 * 24);
    for (const f of firmati.data ?? []) if (f.path && f.signedUrl) indirizzi.set(f.path, f.signedUrl);
  }

  const elenco = righe.map((r): Ricetta => {
    const { ricetta_tag, ricetta_ingredienti, ...resto } = r;
    const suoi = ricetta_tag.map((x) => perId.get(x.tag_id)).filter((t): t is Tag => !!t);
    // "veloce" non è assegnato a mano: vale per le ricette sotto la soglia di tempo della casa
    if (veloce && r.minuti_totali !== null && r.minuti_totali <= soglia) suoi.push(veloce);
    const ingredienti = [...ricetta_ingredienti]
      .sort((a, b) => a.posizione - b.posizione)
      .map(({ ingredienti, posizione: _p, ...i }) => ({
        ...i,
        nome: ingredienti.nome,
        icona: ingredienti.icona,
        base: ingredienti.tracciamento === 'stato',
      }));
    return {
      ...resto,
      passaggi: Array.isArray(r.passaggi) ? r.passaggi : [],
      copertina_url: (r.copertina_path && indirizzi.get(r.copertina_path)) || null,
      tag: suoi.sort((a, b) => a.ordine - b.ordine),
      ingredienti,
      cerca: semplifica([r.titolo, r.autore ?? '', ...ingredienti.map((i) => i.nome)].join(' ')),
    };
  });

  type RigaIngrediente = {
    id: string;
    nome: string;
    icona: string | null;
    tracciamento: 'quantita' | 'stato';
    reparti: { nome: string; ordine: number } | null;
  };
  const ingredienti = ((catalogo.data ?? []) as unknown as RigaIngrediente[]).map(
    (i): Ingrediente => ({
      id: i.id,
      nome: i.nome,
      icona: i.icona,
      base: i.tracciamento === 'stato',
      reparto: i.reparti?.nome ?? null,
      ordine_reparto: i.reparti?.ordine ?? 999,
    }),
  );

  return { casa: (casa.data?.[0] as Casa | undefined) ?? null, tag: tutti, ricette: elenco, ingredienti };
}

/** "450", "20,5": al massimo un decimale, con la virgola */
export function formattaValore(v: number): string {
  return v.toLocaleString('it-IT', { maximumFractionDigits: v < 100 ? 1 : 0 });
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
export function formattaQuantita(
  q: number | null,
  unita: Unita | null,
  fattore: number,
  arrotonda = fattore !== 1,
): string {
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
  if (arrotonda) {
    if (v < 20) arrotondato = Math.max(1, Math.round(v));
    else if (v < 100) arrotondato = Math.round(v / 5) * 5;
    else arrotondato = Math.round(v / 10) * 10;
  }
  if (arrotondato >= 1000) return `${numero(arrotondato / 1000, 2)} ${unita === 'g' ? 'kg' : 'l'}`;
  return `${numero(arrotondato, 1)} ${unita}`;
}

/** Quantità da comprare: arrotondata sempre per eccesso, e a pezzi interi (non si compra ¾ di uovo). */
export function formattaQuantitaSpesa(q: number, unita: Unita | null): string {
  if (unita === 'unita' || unita === null) return numero(Math.ceil(q - 1e-9));
  const passo = q < 20 ? 1 : q < 100 ? 5 : 10;
  const v = Math.ceil(q / passo - 1e-9) * passo;
  if (v >= 1000) return `${numero(v / 1000, 2)} ${unita === 'g' ? 'kg' : 'l'}`;
  return `${numero(v)} ${unita}`;
}

/** Copia locale dei dati, per aprire l'app anche senza connessione. */
export function leggiCache<T>(chiave: string): T | null {
  try {
    const testo = localStorage.getItem(`ricettario.${chiave}`);
    return testo ? (JSON.parse(testo) as T) : null;
  } catch {
    return null;
  }
}

export function scriviCache(chiave: string, valore: unknown): void {
  try {
    localStorage.setItem(`ricettario.${chiave}`, JSON.stringify(valore));
  } catch {
    /* spazio esaurito o archivio non disponibile: si lavora senza copia locale */
  }
}
