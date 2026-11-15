import { useEffect } from 'react';
import { scriviCache } from '../lib/dati';
import { vaiAScheda } from '../lib/rotta';

/** Le due schede della sezione Dispensa: cosa c'è in casa e cosa manca. La sezione ricorda l'ultima aperta. */
export default function SchedeDispensa({ attiva, daComprare }: { attiva: 'dispensa' | 'lista'; daComprare: number }) {
  useEffect(() => scriviCache('scheda-dispensa', attiva), [attiva]);
  const apri = (scheda: 'dispensa' | 'lista') => {
    if (scheda !== attiva) vaiAScheda(`/${scheda}`);
  };
  return (
    <div className="viste due schede-dispensa" role="group" aria-label="Dispensa o lista della spesa">
      <button aria-pressed={attiva === 'dispensa'} onClick={() => apri('dispensa')}>
        In casa
      </button>
      <button aria-pressed={attiva === 'lista'} onClick={() => apri('lista')}>
        Da comprare{daComprare > 0 && <span className="contatore">{daComprare}</span>}
      </button>
    </div>
  );
}
