import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type Rotta =
  | { vista: 'elenco' }
  | { vista: 'ricetta'; id: string }
  | { vista: 'impostazioni' };

function leggi(hash: string): Rotta {
  const m = hash.match(/^#\/ricetta\/([0-9a-f-]{36})$/);
  if (m) return { vista: 'ricetta', id: m[1] };
  if (hash === '#/impostazioni') return { vista: 'impostazioni' };
  return { vista: 'elenco' }; // comprende anche i frammenti del link di accesso via email
}

const ascoltatori = new Set<() => void>();
let scrollElenco = 0;
let vistaCorrente = leggi(window.location.hash).vista;

function aggiorna() {
  const prossima = leggi(window.location.hash).vista;
  const indietro = prossima === 'elenco';
  const applica = () => {
    flushSync(() => ascoltatori.forEach((f) => f()));
    window.scrollTo(0, indietro ? scrollElenco : 0);
    vistaCorrente = prossima;
  };
  const doc = document as Document & { startViewTransition?: (f: () => void) => unknown };
  const fermo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !fermo && prossima !== vistaCorrente) {
    document.documentElement.dataset.direzione = indietro ? 'indietro' : 'avanti';
    doc.startViewTransition(applica);
  } else {
    applica();
  }
}

window.addEventListener('popstate', aggiorna);

export function vai(percorso: string) {
  if (vistaCorrente === 'elenco') scrollElenco = window.scrollY;
  window.history.pushState(null, '', `#${percorso}`);
  aggiorna();
}

/** Torna all'elenco: usa la cronologia se ci siamo arrivati da lì, così il tasto indietro resta coerente. */
export function tornaAllElenco() {
  if (window.history.length > 1 && vistaCorrente !== 'elenco') window.history.back();
  else vai('/');
}

export function usaRotta(): Rotta {
  const hash = useSyncExternalStore(
    (f) => {
      ascoltatori.add(f);
      return () => ascoltatori.delete(f);
    },
    () => window.location.hash,
  );
  return leggi(hash);
}
