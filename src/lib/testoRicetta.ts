// Legge il testo di una ricetta copiato da un sito o da un'altra app e prova a dividerlo in titolo,
// porzioni, ingredienti e passaggi. Solo calcolo, senza rete. Non pretende di capire tutto: il risultato
// riempie il modulo "Nuova ricetta", dove chi lo usa controlla e corregge prima di salvare.
import { semplifica, type Ingrediente } from './dati';

export type IngredienteLetto = {
  /** la riga com'era scritta */
  testo: string;
  /** il nome ripulito, da cercare nel catalogo */
  nome: string;
  /** quantità già convertita in grammi, millilitri o pezzi; null = q.b. o non indicata */
  quantita: number | null;
  unita: 'g' | 'ml' | 'unita' | null;
  /** vero se la quantità viene da una misura a occhio (cucchiaio, tazza) o non è stata capita del tutto */
  stimata: boolean;
};

export type RicettaLetta = { titolo: string; porzioni: number | null; ingredienti: IngredienteLetto[]; passaggi: string[] };

const TITOLO_INGREDIENTI = /^(ingredienti|ingredients|cosa serve|occorrente)\b/i;
const TITOLO_PASSAGGI = /^(preparazione|procedimento|istruzioni|come si fa|passaggi|metodo|method|instructions|directions|steps)\b/i;
const PORZIONI = /(?:per|dosi per|porzioni:?|serves|makes)\s*(\d+)/i;
const FRAZIONI: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.33, '⅔': 0.67 };
const NUMERO = String.raw`(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])`;

/** misura -> [moltiplicatore, unità, è una misura a occhio]. `null` come unità = dipende dall'ingrediente (peso o volume). */
const MISURE: [RegExp, number, 'g' | 'ml' | null, boolean][] = [
  [/^(kg|chili?|chilogramm[oi])$/, 1000, 'g', false],
  [/^(g|gr|grammi?)$/, 1, 'g', false],
  [/^(l|lt|litr[oi])$/, 1000, 'ml', false],
  [/^(dl)$/, 100, 'ml', false],
  [/^(cl)$/, 10, 'ml', false],
  [/^(ml)$/, 1, 'ml', false],
  [/^(cucchiai[oa]?|tbsp|tablespoons?)$/, 15, null, true],
  [/^(cucchiaini?|tsp|teaspoons?)$/, 5, null, true],
  [/^(tazz[ae]|cups?|bicchier[ei])$/, 240, null, true],
];
const PAROLE_MISURA = '(kg|chili?|chilogramm[oi]|gr|grammi?|g|lt|litr[oi]|l|dl|cl|ml|cucchiai[oa]?|cucchiaini?|tbsp|tablespoons?|tsp|teaspoons?|tazz[ae]|cups?|bicchier[ei])';

function numero(testo: string): number {
  const t = testo.trim();
  if (FRAZIONI[t]) return FRAZIONI[t];
  const frazione = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frazione) return Number(frazione[1]) / Number(frazione[2]);
  return Number(t.replace(',', '.'));
}

const pulisci = (nome: string) =>
  nome
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(di|d'|d’|of)\s*/i, '')
    .replace(/\b(q\.?\s?b\.?|quanto basta|to taste)\b/gi, ' ')
    .replace(/[,;:.]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Una riga come "200 g di farina", "2 zucchine", "Farina 00: 200 g", "sale q.b." */
export function leggiIngrediente(riga: string): IngredienteLetto | null {
  const testo = riga.replace(/^[\s\-–•*·▢□☐]+/, '').trim();
  if (!testo) return null;
  const quantoBasta = /\b(q\.?\s?b\.?|quanto basta|to taste)\b/i.test(testo);
  const letto = (nome: string, quantita: number | null, misura: string | null): IngredienteLetto => {
    let unita: IngredienteLetto['unita'] = quantita === null ? null : 'unita';
    let stimata = false;
    if (quantita !== null && misura) {
      const trovata = MISURE.find(([forma]) => forma.test(misura.toLowerCase().replace(/\.$/, '')));
      if (trovata) {
        quantita = Math.round(quantita * trovata[1] * 100) / 100;
        unita = trovata[2];
        stimata = trovata[3];
      }
    }
    return { testo, nome: pulisci(nome), quantita, unita, stimata };
  };

  // "1 barattolo di ceci (240 g)": il peso tra parentesi è più preciso della confezione
  const traParentesi = testo.match(new RegExp(String.raw`\(\s*${NUMERO}\s*${PAROLE_MISURA}\b[^)]*\)`, 'i'));
  if (traParentesi) {
    const nome = testo.replace(new RegExp(String.raw`^${NUMERO}\s*\S+\s+(?:di\s+|d['’])?`, 'i'), '');
    return letto(nome, numero(traParentesi[1]), traParentesi[2]);
  }
  // "200 g di farina", "2 cucchiai d'olio", "2 zucchine", "½ cipolla"
  const davanti = testo.match(new RegExp(String.raw`^${NUMERO}\s*(?:${PAROLE_MISURA}\b\.?)?\s*(.+)$`, 'i'));
  if (davanti && davanti[3].trim()) return letto(davanti[3], numero(davanti[1]), davanti[2] ?? null);
  // "Farina 00: 200 g", "Farina 200g"
  const dietro = testo.match(new RegExp(String.raw`^(.+?)[\s,:–-]+${NUMERO}\s*${PAROLE_MISURA}\b\.?\s*$`, 'i'));
  if (dietro) return letto(dietro[1], numero(dietro[2]), dietro[3]);
  if (quantoBasta || testo.length <= 40) return letto(testo, null, null);
  return null;
}

/** Vero se una riga sembra un ingrediente più che una frase di spiegazione. */
const sembraIngrediente = (riga: string) =>
  riga.length <= 70 && (new RegExp(String.raw`^[\s\-–•*·]*${NUMERO}`).test(riga) || /\bq\.?\s?b\.?\b/i.test(riga)) && !/[.!?]\s+\S/.test(riga);

export function leggiTestoRicetta(testo: string): RicettaLetta {
  const righe = testo.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const risultato: RicettaLetta = { titolo: '', porzioni: null, ingredienti: [], passaggi: [] };
  let sezione: 'inizio' | 'ingredienti' | 'passaggi' = 'inizio';
  const conTitoli = righe.some((r) => TITOLO_INGREDIENTI.test(r)) || righe.some((r) => TITOLO_PASSAGGI.test(r));

  for (const riga of righe) {
    const porzioni = riga.match(PORZIONI);
    if (porzioni && riga.length <= 40 && risultato.porzioni === null) {
      risultato.porzioni = Number(porzioni[1]);
      if (!TITOLO_INGREDIENTI.test(riga)) continue;
    }
    if (TITOLO_INGREDIENTI.test(riga)) {
      sezione = 'ingredienti';
      continue;
    }
    if (TITOLO_PASSAGGI.test(riga)) {
      sezione = 'passaggi';
      continue;
    }
    if (sezione === 'inizio' && !risultato.titolo && !sembraIngrediente(riga)) {
      risultato.titolo = riga.replace(/^#+\s*/, '');
      continue;
    }
    // senza titoli di sezione si va a occhio: le righe corte che iniziano con un numero sono ingredienti
    const comeIngrediente = sezione === 'ingredienti' || (!conTitoli && sembraIngrediente(riga));
    if (comeIngrediente) {
      const letto = leggiIngrediente(riga);
      if (letto) risultato.ingredienti.push(letto);
    } else if (sezione === 'passaggi' || !conTitoli) {
      risultato.passaggi.push(riga.replace(/^\s*(?:\d+[.)°]|[-–•*])\s*/, ''));
    }
  }
  return risultato;
}

/** L'ingrediente del catalogo che corrisponde meglio a un nome letto, oppure null. */
export function trovaNelCatalogo(nome: string, catalogo: Ingrediente[]): Ingrediente | null {
  const cercato = semplifica(nome);
  if (!cercato) return null;
  const esatto = catalogo.find((i) => semplifica(i.nome) === cercato);
  if (esatto) return esatto;
  const parole = cercato.split(/\s+/);
  // radice della parola, per far coincidere singolare e plurale ("zucchina" e "zucchine")
  const radice = (p: string) => (p.length > 4 ? p.slice(0, -1) : p);
  const contiene = (tutte: string[], cercate: string[]) => cercate.every((c) => tutte.some((t) => radice(t) === radice(c)));
  const candidati = catalogo.filter((i) => {
    const sue = semplifica(i.nome).split(/\s+/);
    return contiene(parole, sue) || contiene(sue, parole);
  });
  // tra più candidati, quello con il nome più vicino per lunghezza ("riso" per "riso", non "riso cotto")
  return candidati.sort((a, b) => Math.abs(a.nome.length - nome.length) - Math.abs(b.nome.length - nome.length))[0] ?? null;
}

/**
 * Porta una quantità letta nell'unità dell'ingrediente del catalogo (ogni ingrediente ha una sola unità).
 * `daControllare` è vero quando la conversione è una stima o non è stato possibile farla.
 */
export function adattaQuantita(letto: IngredienteLetto, ingrediente: Ingrediente): { quantita: number | null; daControllare: boolean } {
  if (letto.quantita === null) return { quantita: null, daControllare: false };
  const base = ingrediente.unita_base;
  // cucchiai e tazze: grammi o millilitri a seconda di come si misura l'ingrediente
  const unita = letto.unita ?? (base === 'unita' ? 'g' : base);
  if (unita === base) return { quantita: letto.quantita, daControllare: letto.stimata };
  const pezzo = ingrediente.grammi_per_unita;
  if (unita === 'unita' && base !== 'unita') return pezzo ? { quantita: Math.round(letto.quantita * pezzo), daControllare: true } : { quantita: letto.quantita, daControllare: true };
  if (base === 'unita') return pezzo ? { quantita: Math.round((letto.quantita / pezzo) * 10) / 10, daControllare: true } : { quantita: letto.quantita, daControllare: true };
  // grammi al posto di millilitri o viceversa: per quasi tutti i liquidi di cucina la differenza è piccola
  return { quantita: letto.quantita, daControllare: true };
}
