// Consiglia cosa mangiare per un singolo pasto. Solo calcolo, niente interfaccia e niente rete:
// riceve ricette, dispensa, diario e richieste, e restituisce le ricette in ordine con i motivi.
// Le regole sono fisse e spiegabili (scelta di Paul: niente IA); la stessa funzione servirà a "Proponi settimana".
import { formattaQuantita, formattaValore, semplifica, type Ricetta } from './dati';
import { descriviScadenza, giorniAllaScadenza, riassumiDispensa, type Confezione } from './dispensa';
import { CAMPI_VALORI, moltiplica, valoriRicetta, type Valori, type VoceDiario } from './diario';
import { PASTI, type Pasto } from './piano';

export type Richieste = {
  /** null = non importa per quale pasto (usato dai suggerimenti in dispensa) */
  pasto: Pasto | null;
  /** tempo massimo in minuti; null = qualsiasi */
  minuti: number | null;
  /** id dei tag richiesti: la ricetta deve averli tutti */
  tag: string[];
  /** richiesta libera ("pollo", "qualcosa con le uova"): parole cercate in titolo e ingredienti */
  testo: string;
  /** per quante persone si cucina */
  persone: number;
  /** tieni conto di quello che resta oggi rispetto agli obiettivi */
  obiettivi: boolean;
  /** preferisci le ricette che si possono fare con quello che c'è in casa */
  dispensa: boolean;
  /** preferisci le ricette che usano ciò che sta per scadere */
  scadenze: boolean;
};

export type Mancante = { ingrediente_id: string; nome: string; quanto: string | null };

export type Consiglio = {
  ricetta: Ricetta;
  punteggio: number;
  /** porzioni consigliate per chi chiede (può non essere intera se serve a rientrare negli obiettivi) */
  porzioni: number;
  valori: Valori;
  mancanti: Mancante[];
  /** quanti ingredienti contano per la copertura, e quanti di questi ci sono */
  richiesti: number;
  presenti: number;
  /** frasi da mostrare, dalla più importante */
  motivi: string[];
};

/** Quanto pesa di solito ogni pasto sulla giornata: serve a dividere ciò che resta tra i pasti ancora da fare. */
const PESO_PASTO: Record<Pasto, number> = { colazione: 20, merenda_mattino: 10, pranzo: 30, merenda_pomeriggio: 10, cena: 30 };
const PORZIONI_POSSIBILI = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** tag che dicono che una ricetta non è un pasto principale */
const TAG_LEGGERI = ['colazione', 'snack', 'dolce'];
const PAROLE_VUOTE = new Set(['qualcosa', 'con', 'una', 'uno', 'del', 'della', 'dei', 'delle', 'il', 'la', 'le', 'lo', 'gli', 'di', 'da', 'un', 'e', 'o', 'che', 'voglio', 'vorrei', 'ho', 'voglia', 'per']);

/**
 * La parte di ciò che resta oggi che spetta a questo pasto: quello che manca all'obiettivo del giorno,
 * diviso tra questo pasto e quelli che vengono dopo in proporzione al loro peso.
 * null per i valori senza obiettivo.
 */
export function obiettivoDelPasto(obiettivo: Valori, mangiato: Record<keyof Valori, number>, pasto: Pasto): Valori {
  const ordine = PASTI.map((p) => p.valore);
  const dopo = ordine.slice(ordine.indexOf(pasto));
  const quota = PESO_PASTO[pasto] / dopo.reduce((t, p) => t + PESO_PASTO[p], 0);
  const r: Valori = { kcal: null, proteine_g: null, carboidrati_g: null, grassi_g: null };
  for (const c of CAMPI_VALORI) if (obiettivo[c] !== null) r[c] = Math.max(0, (obiettivo[c] - mangiato[c]) * quota);
  return r;
}

/** Distanza tra i valori di una porzione scalata e l'obiettivo del pasto: 0 = perfetta, 1 = lontana. Contano calorie e proteine. */
function distanza(valori: Valori, meta: Valori): number | null {
  const parti: number[] = [];
  for (const [campo, peso] of [['kcal', 2], ['proteine_g', 1]] as const) {
    const m = meta[campo];
    const v = valori[campo];
    if (m === null || v === null || m <= 0) continue;
    for (let k = 0; k < peso; k++) parti.push(Math.min(1, Math.abs(v - m) / m));
  }
  return parti.length ? parti.reduce((a, b) => a + b, 0) / parti.length : null;
}

const elenco = (nomi: string[]) => (nomi.length <= 3 ? nomi.join(', ') : `${nomi.slice(0, 3).join(', ')} e altri ${nomi.length - 3}`);

export function consiglia(
  ricette: Ricetta[],
  confezioni: Confezione[],
  /** voci del diario degli ultimi giorni (oggi compreso), per non riproporre sempre le stesse cose */
  recenti: VoceDiario[],
  /** obiettivo per questo pasto (da `obiettivoDelPasto`), oppure null se non ci sono obiettivi */
  meta: Valori | null,
  richieste: Richieste,
): Consiglio[] {
  const dispensa = riassumiDispensa(confezioni);
  const dispensaVuota = dispensa.size === 0;
  const parole = semplifica(richieste.testo).split(/\s+/).filter((p) => p.length > 1 && !PAROLE_VUOTE.has(p));
  const tagDelPasto = PASTI.find((p) => p.valore === richieste.pasto)?.tag;
  const principale = richieste.pasto === 'pranzo' || richieste.pasto === 'cena';
  const giorniFa = new Map<string, number>();
  for (const v of recenti) {
    if (!v.ricetta_id) continue;
    const g = -giorniAllaScadenza(v.data); // 0 = oggi, 1 = ieri…
    if (g >= 0 && (giorniFa.get(v.ricetta_id) ?? 99) > g) giorniFa.set(v.ricetta_id, g);
  }

  const proposte: Consiglio[] = [];
  for (const ricetta of ricette) {
    // ---- le richieste esplicite escludono, non spostano soltanto in basso ----
    if (richieste.minuti !== null && (ricetta.minuti_totali === null || ricetta.minuti_totali > richieste.minuti)) continue;
    if (!richieste.tag.every((id) => ricetta.tag.some((t) => t.id === id))) continue;
    if (!parole.every((p) => ricetta.cerca.includes(p))) continue;

    const motivi: string[] = [];
    let punteggio = 0;

    // ---- porzioni: quella che avvicina di più all'obiettivo del pasto ----
    let porzioni = 1;
    let vicino: number | null = null;
    if (richieste.obiettivi && meta) {
      let migliore = Infinity;
      for (const p of PORZIONI_POSSIBILI) {
        const d = distanza(valoriRicetta(ricetta, p), meta);
        // a parità si preferisce la porzione intera
        if (d !== null && d + Math.abs(p - 1) * 0.02 < migliore) {
          migliore = d + Math.abs(p - 1) * 0.02;
          porzioni = p;
          vicino = d;
        }
      }
    }
    const valori = valoriRicetta(ricetta, porzioni);

    // ---- cosa c'è in casa ----
    const daCucinare = (porzioni * richieste.persone) / ricetta.porzioni;
    const mancanti: Mancante[] = [];
    const inScadenza: { nome: string; scadenza: string }[] = [];
    let richiesti = 0;
    for (const i of ricetta.ingredienti) {
      // facoltativi e ingredienti di base (sale, olio, spezie) non decidono se una ricetta si può fare
      if (i.facoltativo || i.base) continue;
      richiesti++;
      const c = dispensa.get(i.ingrediente_id);
      const serve = i.quantita === null ? 0 : i.quantita * daCucinare;
      const ha = c?.quantita ?? 0;
      if (!c || (serve > 0 && ha < serve * 0.9)) {
        // fino al 10% in meno si considera sufficiente: le quantità delle ricette non sono al grammo
        mancanti.push({ ingrediente_id: i.ingrediente_id, nome: i.nome, quanto: serve > 0 && ha > 0 ? formattaQuantita(serve - ha, i.unita, 1, false) : null });
      } else if (c.scadenza && giorniAllaScadenza(c.scadenza) <= 3) {
        inScadenza.push({ nome: i.nome, scadenza: c.scadenza });
      }
    }
    const presenti = richiesti - mancanti.length;
    const copertura = richiesti === 0 ? 1 : presenti / richiesti;

    if (!dispensaVuota) {
      if (mancanti.length === 0) motivi.push('Hai tutto in casa');
      else if (mancanti.length === 1) motivi.push(`Manca solo: ${mancanti[0].nome}${mancanti[0].quanto ? ` (${mancanti[0].quanto})` : ''}`);
      else motivi.push(`Mancano: ${elenco(mancanti.map((m) => m.nome))}`);
      if (richieste.dispensa) punteggio += 45 * copertura + (mancanti.length === 0 ? 10 : 0);
      else punteggio += 10 * copertura;
    }

    if (inScadenza.length > 0) {
      inScadenza.sort((a, b) => a.scadenza.localeCompare(b.scadenza));
      const primo = inScadenza[0];
      motivi.push(`Usa ${elenco(inScadenza.map((x) => x.nome))}: ${descriviScadenza(primo.scadenza).testo}`);
      punteggio += (richieste.scadenze ? 30 : 12) + Math.min(inScadenza.length - 1, 2) * 4;
    }

    // ---- obiettivi ----
    if (vicino !== null) {
      punteggio += 30 * (1 - vicino);
      const quanto = porzioni === 1 ? 'Una porzione' : `${formattaValore(porzioni)} porzioni`;
      const numeri = [valori.kcal !== null && `${Math.round(valori.kcal)} kcal`, valori.proteine_g !== null && `P ${formattaValore(valori.proteine_g)}`].filter(Boolean).join(', ');
      motivi.push(vicino <= 0.15 ? `${quanto}: ${numeri}, in linea con quello che ti resta` : vicino <= 0.4 ? `${quanto}: ${numeri}, abbastanza vicino a quello che ti resta` : `${quanto}: ${numeri}, lontano da quello che ti resta`);
    } else if (richieste.obiettivi && meta && ricetta.kcal === null) {
      punteggio -= 10;
    }

    // ---- adatta al pasto ----
    const nomiTag = ricetta.tag.map((t) => t.nome);
    if (tagDelPasto && nomiTag.includes(tagDelPasto)) punteggio += 15;
    if (principale && nomiTag.some((n) => TAG_LEGGERI.includes(n)) && !nomiTag.some((n) => ['primo', 'secondo', 'piatto unico'].includes(n))) punteggio -= 25;
    if (richieste.pasto && !principale && tagDelPasto && !nomiTag.includes(tagDelPasto)) punteggio -= 15;

    // ---- varietà ----
    const fa = giorniFa.get(ricetta.id);
    if (fa !== undefined && fa <= 3) {
      punteggio -= 18 - fa * 4;
      motivi.push(fa === 0 ? 'L’hai già mangiata oggi' : fa === 1 ? 'L’hai mangiata ieri' : `L’hai mangiata ${fa} giorni fa`);
    }

    if (ricetta.minuti_totali !== null && ricetta.minuti_totali <= 20) punteggio += 3;

    proposte.push({ ricetta, punteggio, porzioni, valori: moltiplica(valori, 1), mancanti, richiesti, presenti, motivi });
  }

  return proposte.sort((a, b) => b.punteggio - a.punteggio || a.ricetta.titolo.localeCompare(b.ricetta.titolo, 'it'));
}
