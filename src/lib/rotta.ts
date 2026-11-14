import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type Rotta =
  | { vista: 'elenco' }
  | { vista: 'menu' }
  | { vista: 'lista' }
  | { vista: 'ricetta'; id: string }
  | { vista: 'impostazioni' }
  | { vista: 'tag' };

export type Vista = Rotta['vista'];

/** Le tre schermate della barra in basso; le altre si aprono "sopra" e hanno il tasto indietro. */
export const PRINCIPALI: Vista[] = ['elenco', 'menu', 'lista'];

function leggi(hash: string): Rotta {
  const m = hash.match(/^#\/ricetta\/([0-9a-f-]{36})$/);
  if (m) return { vista: 'ricetta', id: m[1] };
  if (hash === '#/menu') return { vista: 'menu' };
  if (hash === '#/lista') return { vista: 'lista' };
  if (hash === '#/impostazioni') return { vista: 'impostazioni' };
  if (hash === '#/tag') return { vista: 'tag' };
  return { vista: 'elenco' }; // comprende anche i frammenti del link di accesso via email
}

const ascoltatori = new Set<() => void>();
const scroll = new Map<Vista, number>();
let vistaCorrente = leggi(window.location.hash).vista;

function aggiorna() {
  const prossima = leggi(window.location.hash).vista;
  const versoPrincipale = PRINCIPALI.includes(prossima);
  const daPrincipale = PRINCIPALI.includes(vistaCorrente);
  const direzione = !versoPrincipale ? 'avanti' : daPrincipale ? 'scheda' : 'indietro';
  const applica = () => {
    flushSync(() => ascoltatori.forEach((f) => f()));
    // tornando a una schermata principale si ritrova il punto in cui la si era lasciata
    window.scrollTo(0, versoPrincipale ? (scroll.get(prossima) ?? 0) : 0);
    vistaCorrente = prossima;
  };
  const doc = document as Document & { startViewTransition?: (f: () => void) => unknown };
  const fermo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !fermo && prossima !== vistaCorrente) {
    document.documentElement.dataset.direzione = direzione;
    doc.startViewTransition(applica);
  } else {
    applica();
  }
}

const ricordaScroll = () => {
  if (PRINCIPALI.includes(vistaCorrente)) scroll.set(vistaCorrente, window.scrollY);
};

window.addEventListener('popstate', aggiorna);

export function vai(percorso: string) {
  ricordaScroll();
  window.history.pushState(null, '', `#${percorso}`);
  aggiorna();
}

/** Passa a un'altra schermata della barra senza allungare la cronologia. */
export function vaiAScheda(percorso: string) {
  ricordaScroll();
  window.history.replaceState(null, '', `#${percorso}`);
  aggiorna();
}

/** Torna alla schermata da cui si è arrivati; se non c'è (pagina aperta da un link), all'elenco. */
export function tornaAllElenco() {
  if (window.history.length > 1 && !PRINCIPALI.includes(vistaCorrente)) window.history.back();
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
