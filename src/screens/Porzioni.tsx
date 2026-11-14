import { nomePorzioni } from '../lib/piano';

/** Selettore − n + per le porzioni, usato nella scheda ricetta e nel menù. */
export default function Porzioni({ valore, cambia }: { valore: number; cambia: (n: number) => void }) {
  return (
    <div className="porzioni" role="group" aria-label="Porzioni">
      <button type="button" aria-label="Una porzione in meno" disabled={valore <= 1} onClick={() => cambia(Math.max(1, valore - 1))}>
        −
      </button>
      <output aria-live="polite">{nomePorzioni(valore)}</output>
      <button type="button" aria-label="Una porzione in più" disabled={valore >= 24} onClick={() => cambia(valore + 1)}>
        +
      </button>
    </div>
  );
}
