// Le date del menù sono giorni di calendario ("2026-11-16"), senza ora: si costruiscono
// sempre con anno, mese e giorno locali per non scivolare di un giorno con i fusi orari.
const due = (n: number) => String(n).padStart(2, '0');

export const iso = (d: Date) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;

export function daIso(s: string): Date {
  const [anno, mese, giorno] = s.split('-').map(Number);
  return new Date(anno, mese - 1, giorno);
}

export const oggi = () => iso(new Date());

export function piuGiorni(s: string, n: number): string {
  const d = daIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Il lunedì della settimana che contiene il giorno dato. */
export function lunedi(s: string): string {
  const d = daIso(s);
  return piuGiorni(s, -((d.getDay() + 6) % 7));
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Lunedì 16" */
export const nomeGiorno = (s: string) =>
  maiuscola(daIso(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' }));

/** "oggi", "domani", "mercoledì 18 novembre" */
export function giornoRelativo(s: string): string {
  if (s === oggi()) return 'oggi';
  if (s === piuGiorni(oggi(), 1)) return 'domani';
  return daIso(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "16 – 22 novembre", oppure "30 novembre – 6 dicembre" */
export function nomeSettimana(dal: string): string {
  const a = daIso(dal);
  const b = daIso(piuGiorni(dal, 6));
  const mese = (d: Date) => d.toLocaleDateString('it-IT', { month: 'long' });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${mese(b)}`
    : `${a.getDate()} ${mese(a)} – ${b.getDate()} ${mese(b)}`;
}
