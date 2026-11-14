import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { leggiCache, scriviCache, type Unita } from './dati';

// Lista della spesa con funzionamento offline.
// - `voci` è l'ultima copia letta dal database, salvata anche sul telefono.
// - `coda` sono le modifiche fatte e non ancora arrivate al database (spunte e voci aggiunte).
// Quello che si vede è `voci` con sopra la `coda`. Quando c'è connessione la coda viene
// inviata in ordine e poi la lista viene riletta.

export type Voce = {
  id: string;
  ingrediente_id: string | null;
  testo: string | null;
  quantita: number | null;
  unita: Unita | null;
  spuntata: boolean;
  origine: 'menu' | 'scorta' | 'manuale';
};

type Operazione =
  | { tipo: 'spunta'; id: string; spuntata: boolean; quando: string }
  | { tipo: 'aggiungi'; voce: Voce };

type Stato = {
  voci: Voce[];
  coda: Operazione[];
  /** true dopo la prima lettura riuscita, o se c'è una copia locale */
  pronta: boolean;
  /** l'ultimo tentativo di sincronizzare non è riuscito per mancanza di rete */
  offline: boolean;
  /** quello che si vede: voci con la coda applicata */
  visibili: Voce[];
};

const CAMPI = 'id, ingrediente_id, testo, quantita, unita, spuntata, origine';

function applica(voci: Voce[], coda: Operazione[]): Voce[] {
  let risultato = voci;
  for (const op of coda) {
    if (op.tipo === 'spunta') {
      risultato = risultato.map((v) => (v.id === op.id ? { ...v, spuntata: op.spuntata } : v));
    } else if (!risultato.some((v) => v.id === op.voce.id)) {
      risultato = [...risultato, op.voce];
    }
  }
  return risultato;
}

let casa: string | null = null;
let stato: Stato = { voci: [], coda: [], pronta: false, offline: false, visibili: [] };
const ascoltatori = new Set<() => void>();
let inCorso: Promise<void> | null = null;

function imposta(parte: Partial<Omit<Stato, 'visibili'>>) {
  const prossimo = { ...stato, ...parte };
  stato = { ...prossimo, visibili: applica(prossimo.voci, prossimo.coda) };
  scriviCache('lista', { casa, voci: stato.voci, coda: stato.coda });
  ascoltatori.forEach((f) => f());
}

function avvia(casaId: string) {
  if (casa === casaId) return;
  casa = casaId;
  const copia = leggiCache<{ casa: string; voci: Voce[]; coda: Operazione[] }>('lista');
  if (copia && copia.casa === casaId) imposta({ voci: copia.voci, coda: copia.coda, pronta: true });
  else imposta({ voci: [], coda: [], pronta: false });
}

/**
 * Un errore del database ha un codice SQL di 5 caratteri (per esempio 23503): riprovare non serve.
 * Tutti gli altri (rete assente, sessione da rinnovare, server non raggiungibile) si riprovano più tardi.
 */
const diRete = (e: { code?: string } | null) => !!e && !/^[0-9A-Z]{5}$/.test(e.code ?? '');

async function esegui(): Promise<void> {
  if (!casa) return;
  // 1. invia la coda, un'operazione alla volta e nell'ordine in cui è stata fatta
  while (stato.coda.length) {
    const op = stato.coda[0];
    const { error } =
      op.tipo === 'spunta'
        ? await supabase
            .from('lista_spesa')
            .update({ spuntata: op.spuntata, spuntata_il: op.spuntata ? op.quando : null })
            .eq('id', op.id)
        : await supabase.from('lista_spesa').upsert(
            {
              id: op.voce.id,
              casa_id: casa,
              ingrediente_id: op.voce.ingrediente_id,
              testo: op.voce.testo,
              spuntata: op.voce.spuntata,
              origine: 'manuale',
            },
            { onConflict: 'id', ignoreDuplicates: true },
          );
    if (diRete(error)) {
      imposta({ offline: true });
      return;
    }
    // riuscita, oppure rifiutata dal database (per esempio voce già eliminata): in entrambi i casi si toglie
    imposta({ coda: stato.coda.filter((x) => x !== op) });
  }
  // 2. rilegge la lista
  const { data, error } = await supabase.from('lista_spesa').select(CAMPI).eq('casa_id', casa).order('creata_il');
  if (error) {
    imposta({ offline: diRete(error) });
    return;
  }
  // le operazioni arrivate mentre si leggeva restano in coda e vengono applicate sopra
  imposta({ voci: (data ?? []) as Voce[], pronta: true, offline: false });
}

/** Invia le modifiche in sospeso e rilegge la lista. Chiamate ravvicinate si accodano senza sovrapporsi. */
export function sincronizza(): Promise<void> {
  inCorso = (inCorso ?? Promise.resolve()).then(esegui, esegui);
  return inCorso;
}

export function spunta(id: string, spuntata: boolean) {
  imposta({ coda: [...stato.coda, { tipo: 'spunta', id, spuntata, quando: new Date().toISOString() }] });
  void sincronizza();
}

export function aggiungi(testo: string | null, ingredienteId: string | null) {
  const voce: Voce = {
    id: crypto.randomUUID(),
    ingrediente_id: ingredienteId,
    testo: ingredienteId ? null : testo,
    quantita: null,
    unita: null,
    spuntata: false,
    origine: 'manuale',
  };
  imposta({ coda: [...stato.coda, { tipo: 'aggiungi', voce }] });
  void sincronizza();
}

/** Elimina voci: serve la connessione. Restituisce il messaggio d'errore, o null se è andata bene. */
export async function elimina(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  await sincronizza();
  const { error } = await supabase.from('lista_spesa').delete().in('id', ids);
  if (error) return diRete(error) ? 'Per eliminare serve la connessione.' : error.message;
  imposta({ voci: stato.voci.filter((v) => !ids.includes(v.id)) });
  return null;
}

export function usaLista(casaId: string): Stato {
  avvia(casaId);
  useEffect(() => {
    void sincronizza();
    const riprova = () => void sincronizza();
    const visibile = () => document.visibilityState === 'visible' && void sincronizza();
    window.addEventListener('online', riprova);
    document.addEventListener('visibilitychange', visibile);
    return () => {
      window.removeEventListener('online', riprova);
      document.removeEventListener('visibilitychange', visibile);
    };
  }, [casaId]);
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f);
      return () => ascoltatori.delete(f);
    },
    () => stato,
  );
}
