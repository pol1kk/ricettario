// "Proponi settimana": riempie gli spazi vuoti del menù. Solo calcolo, senza rete né interfaccia.
//
// Tre passi, decisi con Paul:
//  1. pasti comuni (pranzo e cena), scelti perché vadano bene a tutte le persone della casa: ciò che uno non
//     mangia è escluso per tutti, e per ognuno si calcola la porzione più adatta ai suoi obiettivi;
//  2. per ogni persona con obiettivi, colazione e merende personali che colmano quello che manca;
//  3. niente di automatico oltre: se un pasto comune resta lontano dagli obiettivi di qualcuno lo si segnala
//     (`lontanoDagliObiettivi`) e la persona può chiedere un'alternativa solo per sé (`alternativaPerMe`).
//
// Le porzioni restano sempre sensate: una ricetta va da mezza a due porzioni, un alimento singolo da metà a una
// volta e mezza la sua porzione tipica, e ogni pasto punta alla sua quota della giornata, non a colmare tutto.
import { type Ingrediente, type Ricetta } from './dati';
import { PESO_PASTO, distanza, porzioneConsigliata } from './consiglio';
import { giorniAllaScadenza, riassumiDispensa, type Confezione } from './dispensa';
import { CAMPI_VALORI, SENZA_VALORI, giornoSettimana, moltiplica, obiettivoDel, somma, valoriAlimento, valoriRicetta, type Obiettivi, type Valori } from './diario';
import { piuGiorni } from './date';
import { vociPerMe, type AlimentoVoce, type NuovaVocePiano, type Pasto, type VocePiano } from './piano';
import type { Limite, PreferenzeCasa, PreferenzePersona } from './preferenze';

export type Persona = { utente: string; pref: PreferenzePersona; obiettivi: Obiettivi | null };

export type Contesto = {
  ricette: Ricetta[];
  ingredienti: Ingrediente[];
  confezioni: Confezione[];
  casa: PreferenzeCasa;
  /** porzioni abituali della casa, se le preferenze non dicono per quante persone si cucina */
  porzioniCasa: number;
  persone: Persona[];
};

/** Una voce del menù, esistente o appena proposta: all'algoritmo servono solo questi campi. */
type Voce = Pick<VocePiano, 'data' | 'pasto' | 'ricetta_id' | 'porzioni' | 'per_utente'> & { alimenti?: AlimentoVoce[] | null };

const COMUNI: Pasto[] = ['pranzo', 'cena'];
const PERSONALI: Pasto[] = ['colazione', 'merenda_mattino', 'merenda_pomeriggio'];
const TAG_PRINCIPALI = ['primo', 'secondo', 'piatto unico'];
const TAG_SGARRO = ['sfiziosa', 'comfort'];
/** oltre questa distanza un pasto comune è "lontano" dagli obiettivi di una persona, anche cambiando porzione */
const LONTANO = 0.45;
const FATTORI_SPUNTINO = [0.5, 0.75, 1, 1.25, 1.5];
/** coppie di alimenti che ha senso mangiare insieme, per ruolo */
const COPPIE: [string, string][] = [
  ['latticino', 'pane'],
  ['latticino', 'cereali'],
  ['latticino', 'frutta'],
  ['latticino', 'frutta_secca'],
  ['latticino', 'polvere'],
  ['uova', 'pane'],
  ['pane', 'frutta_secca'],
  ['frutta', 'frutta_secca'],
];

const feriale = (data: string) => giornoSettimana(data) <= 5;
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Numero tra 0 e 1 che dipende solo dal testo: serve a variare le proposte da una settimana all'altra senza casualità. */
function sorte(testo: string): number {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) h = Math.imul(h ^ testo.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function daPianificare(casa: PreferenzeCasa, pasto: Pasto, data: string): boolean {
  const quando = casa.pasti?.[pasto] ?? 'sempre';
  return quando === 'sempre' || (quando === 'feriali' && feriale(data)) || (quando === 'weekend' && !feriale(data));
}

/** La quota dell'obiettivo del giorno che spetta a un pasto; null se la persona non ha (o non vuole usare) obiettivi. */
export function metaPasto(persona: Persona, data: string, pasto: Pasto): Valori | null {
  if (!persona.obiettivi || persona.pref.obiettivi === false) return null;
  const giorno = obiettivoDel(persona.obiettivi, data);
  if (CAMPI_VALORI.every((c) => giorno[c] === null)) return null;
  return moltiplica(giorno, PESO_PASTO[pasto] / 100);
}

function contenuto(ctx: Contesto, catalogo: Map<string, Ingrediente>, v: Voce): { ingredienti: Set<string>; gruppi: Set<string> } {
  const ids = v.ricetta_id
    ? (ctx.ricette.find((r) => r.id === v.ricetta_id)?.ingredienti ?? []).filter((i) => !i.facoltativo).map((i) => i.ingrediente_id)
    : (v.alimenti ?? []).map((a) => a.ingrediente_id);
  const gruppi = new Set<string>();
  for (const id of ids) {
    const g = catalogo.get(id)?.gruppo;
    if (g) gruppi.add(g);
  }
  return { ingredienti: new Set(ids), gruppi };
}

const tocca = (l: Limite, c: { ingredienti: Set<string>; gruppi: Set<string> }) => (l.tipo === 'gruppo' ? c.gruppi.has(l.id) : c.ingredienti.has(l.id));

/** Vero se aggiungere `nuova` farebbe superare a `persona` uno dei suoi limiti settimanali. */
function superaLimiti(ctx: Contesto, catalogo: Map<string, Ingrediente>, persona: Persona, voci: Voce[], nuova: Voce): boolean {
  const limiti = persona.pref.limiti ?? [];
  if (limiti.length === 0) return false;
  const dentro = contenuto(ctx, catalogo, nuova);
  const sue = vociPerMe(voci as VocePiano[], persona.utente);
  return limiti.some((l) => tocca(l, dentro) && sue.filter((v) => tocca(l, contenuto(ctx, catalogo, v))).length >= l.max);
}

/** Quello che una voce del menù porta a una persona, con la porzione che le spetta. */
function valoriPer(ctx: Contesto, catalogo: Map<string, Ingrediente>, v: Voce, persona: Persona): Valori {
  if (v.ricetta_id) {
    const r = ctx.ricette.find((x) => x.id === v.ricetta_id);
    if (!r) return SENZA_VALORI;
    if (v.per_utente) return valoriRicetta(r, v.porzioni ?? 1);
    const meta = metaPasto(persona, v.data, v.pasto);
    return valoriRicetta(r, meta ? porzioneConsigliata(r, meta).porzioni : 1);
  }
  const t = somma((v.alimenti ?? []).map((a) => (catalogo.has(a.ingrediente_id) ? valoriAlimento(catalogo.get(a.ingrediente_id)!, a.quantita) : SENZA_VALORI)));
  return v.alimenti?.length ? t : SENZA_VALORI;
}

/**
 * Una ricetta si propone a pranzo o a cena solo se ha un tag di portata principale (primo, secondo, piatto unico):
 * una salsa o un contorno senza quel tag non diventano un pasto.
 */
function principale(r: Ricetta): boolean {
  return r.tag.some((t) => TAG_PRINCIPALI.includes(t.nome));
}

type Candidato = { voce: NuovaVocePiano; punteggio: number };

/**
 * Ricette adatte a un pasto principale, dalla migliore. Con più persone è un pasto comune (porzioni sommate);
 * con una sola persona e `personale` è l'alternativa solo per lei.
 */
function candidatiPrincipali(
  ctx: Contesto,
  catalogo: Map<string, Ingrediente>,
  voci: Voce[],
  data: string,
  pasto: Pasto,
  settimana: string,
  opzioni: { sgarro: boolean; persone: Persona[]; personale: boolean },
): Candidato[] {
  const { casa } = ctx;
  const minuti = feriale(data) ? casa.minuti_feriali : casa.minuti_weekend;
  const dispensa = riassumiDispensa(ctx.confezioni);
  const usaDispensa = casa.dispensa !== false && dispensa.size > 0;
  const usate = new Map<string, number>();
  for (const v of voci) if (v.ricetta_id) usate.set(v.ricetta_id, (usate.get(v.ricetta_id) ?? 0) + 1);
  const ieri = piuGiorni(data, -1);
  const vicine = new Set(voci.filter((v) => v.ricetta_id && (v.data === data || v.data === ieri)).map((v) => v.ricetta_id));

  const candidati: Candidato[] = [];
  for (const r of ctx.ricette) {
    if (!principale(r)) continue;
    if (minuti != null && (r.minuti_totali === null || r.minuti_totali > minuti)) continue;
    const volte = usate.get(r.id) ?? 0;
    // se non è stato detto nulla la stessa ricetta si propone una volta sola a settimana; null = non importa
    const massimo = casa.max_ripetizioni === undefined ? 1 : casa.max_ripetizioni;
    if (massimo !== null && volte >= massimo) continue;
    // quello che una persona non mangia, o ha già mangiato abbastanza questa settimana, esclude il piatto per tutti
    const tagRicetta = new Set(r.tag.map((t) => t.id));
    if (opzioni.persone.some((p) => (p.pref.tag_no ?? []).some((id) => tagRicetta.has(id)))) continue;
    const prova: Voce = { data, pasto, ricetta_id: r.id, porzioni: null, per_utente: opzioni.personale ? opzioni.persone[0].utente : null };
    if (opzioni.persone.some((p) => superaLimiti(ctx, catalogo, p, voci, prova))) continue;

    let punteggio = sorte(`${settimana} ${data} ${pasto} ${r.id}`) * 8;
    let porzioni = 0;
    const distanze: number[] = [];
    for (const p of opzioni.persone) {
      const meta = opzioni.sgarro ? null : metaPasto(p, data, pasto);
      const scelta = meta ? porzioneConsigliata(r, meta) : { porzioni: 1, distanza: null };
      porzioni += scelta.porzioni;
      if (scelta.distanza !== null) distanze.push(scelta.distanza);
      if ((p.pref.tag_si ?? []).some((id) => tagRicetta.has(id))) punteggio += 6;
    }
    if (distanze.length) punteggio += 30 * (1 - distanze.reduce((a, b) => a + b, 0) / distanze.length);
    if (opzioni.sgarro) punteggio += r.tag.some((t) => TAG_SGARRO.includes(t.nome)) ? 60 : 0;

    if (usaDispensa) {
      const conta = r.ingredienti.filter((i) => !i.facoltativo && !i.base);
      const presenti = conta.filter((i) => (dispensa.get(i.ingrediente_id)?.quantita ?? 0) > 0);
      if (conta.length) punteggio += 20 * (presenti.length / conta.length);
      if (presenti.some((i) => { const s = dispensa.get(i.ingrediente_id)?.scadenza; return s && giorniAllaScadenza(s) <= 7; })) punteggio += 10;
    }
    punteggio -= 25 * volte;
    if (vicine.has(r.id)) punteggio -= 30;

    if (!opzioni.personale) {
      // chi non ha obiettivi conta una porzione; se la casa cucina per più persone di quante usano l'app, una a testa
      porzioni += Math.max(0, (casa.persone ?? ctx.porzioniCasa) - opzioni.persone.length);
      porzioni = Math.max(1, Math.round(porzioni * 2) / 2);
    }
    candidati.push({
      punteggio,
      voce: { data, pasto, ricetta_id: r.id, nota: null, alimenti: null, porzioni, per_utente: opzioni.personale ? opzioni.persone[0].utente : null, proposta: true },
    });
  }
  return candidati.sort((a, b) => b.punteggio - a.punteggio);
}

const arrotonda = (q: number, i: Ingrediente) => (i.unita_base === 'unita' ? Math.max(1, Math.round(q)) : Math.max(5, Math.round(q / 5) * 5));

/**
 * Colazioni e merende per una persona: ricette adatte (tag "colazione" o "snack") e alimenti singoli o in coppia
 * ("fiocchi di latte e gallette"), ognuno vicino alla sua porzione tipica, dal più vicino a `meta`.
 */
function candidatiSpuntino(
  ctx: Contesto,
  catalogo: Map<string, Ingrediente>,
  voci: Voce[],
  persona: Persona,
  data: string,
  pasto: Pasto,
  meta: Valori,
  settimana: string,
): Candidato[] {
  const dispensa = riassumiDispensa(ctx.confezioni);
  const sue = vociPerMe(voci as VocePiano[], persona.utente);
  const chiave = (v: Voce) => v.ricetta_id ?? (v.alimenti ?? []).map((a) => a.ingrediente_id).sort().join('+');
  const giaUsate = new Map<string, number>();
  for (const v of sue) giaUsate.set(chiave(v), (giaUsate.get(chiave(v)) ?? 0) + 1);
  const candidati: Candidato[] = [];
  const aggiungi = (voce: NuovaVocePiano, d: number, inCasa: boolean) => {
    if (superaLimiti(ctx, catalogo, persona, voci, voce)) return;
    candidati.push({ voce, punteggio: 40 * (1 - d) + (inCasa ? 10 : 0) - 12 * (giaUsate.get(chiave(voce)) ?? 0) + sorte(`${settimana} ${data} ${pasto} ${persona.utente} ${chiave(voce)}`) * 6 });
  };
  const base = { data, pasto, per_utente: persona.utente, proposta: true };

  const tag = pasto === 'colazione' ? 'colazione' : 'snack';
  const tagNo = new Set(persona.pref.tag_no ?? []);
  for (const r of ctx.ricette) {
    if (!r.tag.some((t) => t.nome === tag) || r.tag.some((t) => tagNo.has(t.id))) continue;
    const scelta = porzioneConsigliata(r, meta);
    if (scelta.distanza === null) continue;
    const conta = r.ingredienti.filter((i) => !i.facoltativo && !i.base);
    const inCasa = conta.length > 0 && conta.every((i) => (dispensa.get(i.ingrediente_id)?.quantita ?? 0) > 0);
    aggiungi({ ...base, ricetta_id: r.id, nota: null, alimenti: null, porzioni: scelta.porzioni }, scelta.distanza, inCasa);
  }

  const alimenti = ctx.ingredienti.filter((i) => i.porzione_spuntino && i.ruolo_spuntino && i.kcal_100 !== null);
  const gruppi: Ingrediente[][] = alimenti.map((a) => [a]);
  for (let x = 0; x < alimenti.length; x++) {
    for (let y = x + 1; y < alimenti.length; y++) {
      const [a, b] = [alimenti[x], alimenti[y]];
      if (COPPIE.some(([r1, r2]) => (a.ruolo_spuntino === r1 && b.ruolo_spuntino === r2) || (a.ruolo_spuntino === r2 && b.ruolo_spuntino === r1))) gruppi.push([a, b]);
    }
  }
  for (const gruppo of gruppi) {
    let migliore: { d: number; quantita: AlimentoVoce[] } | null = null;
    for (const f of FATTORI_SPUNTINO) {
      const quantita = gruppo.map((i) => ({ ingrediente_id: i.id, quantita: arrotonda(i.porzione_spuntino! * f, i) }));
      const totale = somma(quantita.map((q, n) => valoriAlimento(gruppo[n], q.quantita)));
      const d = distanza(totale, meta);
      if (d !== null && (!migliore || d + Math.abs(f - 1) * 0.02 < migliore.d)) migliore = { d: d + Math.abs(f - 1) * 0.02, quantita };
    }
    if (!migliore) continue;
    const inCasa = gruppo.every((i) => (dispensa.get(i.id)?.quantita ?? 0) > 0);
    const nome = maiuscola(gruppo.map((i) => i.nome).join(' e '));
    aggiungi({ ...base, ricetta_id: null, nota: nome, alimenti: migliore.quantita, porzioni: null }, migliore.d, inCasa);
  }
  return candidati.sort((a, b) => b.punteggio - a.punteggio);
}

/** Le cene (di solito del fine settimana) in cui proporre uno sgarro. */
function giorniDiSgarro(casa: PreferenzeCasa, giorni: string[]): Set<string> {
  const quanti = casa.sgarri ?? 0;
  const ordine = casa.giorni_sgarro?.length ? casa.giorni_sgarro : [6, 7, 5, 3, 4, 2, 1];
  const scelti = new Set<string>();
  for (const g of ordine) {
    if (scelti.size >= quanti) break;
    const data = giorni.find((d) => giornoSettimana(d) === g);
    if (data && daPianificare(casa, 'cena', data)) scelti.add(data);
  }
  return scelti;
}

/**
 * Propone le voci per gli spazi vuoti della settimana che inizia da `lunedi`, a partire dal giorno `dal`
 * (i giorni passati non si toccano). Non modifica `esistenti`: restituisce le voci da aggiungere.
 */
export function proponiSettimana(ctx: Contesto, lunedi: string, esistenti: VocePiano[], dal: string): NuovaVocePiano[] {
  const catalogo = new Map(ctx.ingredienti.map((i) => [i.id, i]));
  const giorni = Array.from({ length: 7 }, (_, n) => piuGiorni(lunedi, n)).filter((d) => d >= dal);
  const tutte: Voce[] = [...esistenti];
  const nuove: NuovaVocePiano[] = [];
  const metti = (v: NuovaVocePiano) => {
    tutte.push(v);
    nuove.push(v);
  };
  const sgarri = giorniDiSgarro(ctx.casa, giorni);

  // 1. pasti comuni
  for (const data of giorni) {
    for (const pasto of COMUNI) {
      if (!daPianificare(ctx.casa, pasto, data) || tutte.some((v) => v.data === data && v.pasto === pasto && !v.per_utente)) continue;
      if (pasto === 'pranzo' && ctx.casa.avanzi) {
        // "cucino una volta per due pasti": il pranzo riprende la cena del giorno prima
        const cena = tutte.find((v) => v.data === piuGiorni(data, -1) && v.pasto === 'cena' && !v.per_utente && v.ricetta_id);
        if (cena) {
          metti({ data, pasto, ricetta_id: cena.ricetta_id, nota: null, alimenti: null, porzioni: cena.porzioni, per_utente: null, proposta: true });
          continue;
        }
      }
      const scelta = candidatiPrincipali(ctx, catalogo, tutte, data, pasto, lunedi, {
        sgarro: pasto === 'cena' && sgarri.has(data),
        persone: ctx.persone,
        personale: false,
      })[0];
      if (scelta) metti(scelta.voce);
    }
  }

  // 2. colazione e merende personali, per chi ha obiettivi
  for (const persona of ctx.persone) {
    for (const data of giorni) {
      if (!persona.obiettivi || persona.pref.obiettivi === false) break;
      const obiettivo = obiettivoDel(persona.obiettivi, data);
      if (CAMPI_VALORI.every((c) => obiettivo[c] === null)) continue;
      const sue = vociPerMe(tutte as VocePiano[], persona.utente).filter((v) => v.data === data);
      const vuoti = PERSONALI.filter((p) => daPianificare(ctx.casa, p, data) && !sue.some((v) => v.pasto === p));
      if (vuoti.length === 0) continue;
      const previsto = somma(sue.map((v) => valoriPer(ctx, catalogo, v, persona)));
      const pesi = vuoti.reduce((t, p) => t + PESO_PASTO[p], 0);
      for (const pasto of vuoti) {
        // la parte di ciò che manca che spetta a questo pasto, mai più di una volta e mezza la sua quota normale
        const meta: Valori = { ...SENZA_VALORI };
        for (const c of CAMPI_VALORI) {
          if (obiettivo[c] === null) continue;
          meta[c] = Math.min(Math.max(0, obiettivo[c] - previsto[c]) * (PESO_PASTO[pasto] / pesi), obiettivo[c] * (PESO_PASTO[pasto] / 100) * 1.5);
        }
        if (meta.kcal !== null && meta.kcal < 60) continue;
        const scelta = candidatiSpuntino(ctx, catalogo, tutte, persona, data, pasto, meta, lunedi)[0];
        if (scelta) metti(scelta.voce);
      }
    }
  }
  return nuove;
}

/** Altre proposte al posto di una voce, dalla migliore, esclusa quella attuale ("Un'altra"). */
export function alternative(ctx: Contesto, lunedi: string, voci: VocePiano[], voce: VocePiano): NuovaVocePiano[] {
  const catalogo = new Map(ctx.ingredienti.map((i) => [i.id, i]));
  const altre: Voce[] = voci.filter((v) => v.id !== voce.id);
  const persona = voce.per_utente ? ctx.persone.find((p) => p.utente === voce.per_utente) : undefined;
  let candidati: Candidato[];
  if (!COMUNI.includes(voce.pasto) && persona) {
    // una merenda o colazione personale si sostituisce con qualcosa della stessa taglia
    const attuale = valoriPer(ctx, catalogo, voce, persona);
    candidati = candidatiSpuntino(ctx, catalogo, altre, persona, voce.data, voce.pasto, attuale, lunedi);
  } else {
    candidati = candidatiPrincipali(ctx, catalogo, altre, voce.data, voce.pasto, lunedi, {
      sgarro: false,
      persone: persona ? [persona] : ctx.persone,
      personale: !!persona,
    });
  }
  const uguale = (v: NuovaVocePiano) => (voce.ricetta_id ? v.ricetta_id === voce.ricetta_id : !v.ricetta_id && v.nota === voce.nota);
  return candidati.map((c) => c.voce).filter((v) => !uguale(v));
}

/** Un pasto principale solo per una persona, al posto di quello comune, il più vicino possibile ai suoi obiettivi. */
export function alternativaPerMe(ctx: Contesto, lunedi: string, voci: VocePiano[], comune: VocePiano, utente: string): NuovaVocePiano | null {
  const persona = ctx.persone.find((p) => p.utente === utente);
  if (!persona) return null;
  const catalogo = new Map(ctx.ingredienti.map((i) => [i.id, i]));
  const candidati = candidatiPrincipali(ctx, catalogo, voci, comune.data, comune.pasto, lunedi, { sgarro: false, persone: [persona], personale: true });
  return candidati.map((c) => c.voce).find((v) => v.ricetta_id !== comune.ricetta_id) ?? null;
}

/** Vero se un pasto comune resta lontano dagli obiettivi della persona anche scegliendo la porzione migliore. */
export function lontanoDagliObiettivi(ctx: Contesto, voce: VocePiano, utente: string): boolean {
  const persona = ctx.persone.find((p) => p.utente === utente);
  const ricetta = voce.ricetta_id ? ctx.ricette.find((r) => r.id === voce.ricetta_id) : undefined;
  // uno sgarro è lontano dagli obiettivi per scelta: non va segnalato
  if (!persona || !ricetta || voce.per_utente || ricetta.tag.some((t) => TAG_SGARRO.includes(t.nome))) return false;
  const meta = metaPasto(persona, voce.data, voce.pasto);
  const d = meta ? porzioneConsigliata(ricetta, meta).distanza : null;
  return d !== null && d > LONTANO;
}
