import { useState, type ChangeEvent } from 'react';
import type { Ricetta } from '../lib/dati';
import { salvaCopertina } from '../lib/foto';

/** Icona del primo ingrediente con quantità: di solito è l'ingrediente principale. */
function iconaPrincipale(r: Ricetta): string | null {
  return (r.ingredienti.find((i) => i.icona && i.quantita !== null) ?? r.ingredienti.find((i) => i.icona))?.icona ?? null;
}

/** Riquadro mostrato finché non c'è una foto: tinta scelta dal titolo, così resta sempre la stessa. */
export function Segnaposto({ ricetta, className = '' }: { ricetta: Ricetta; className?: string }) {
  const tinta = [...ricetta.titolo].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  return (
    <span className={`segnaposto tinta-${tinta} ${className}`} aria-hidden="true">
      {iconaPrincipale(ricetta)}
    </span>
  );
}

export function Miniatura({ ricetta }: { ricetta: Ricetta }) {
  return ricetta.copertina_url ? (
    <img className="miniatura" src={ricetta.copertina_url} alt="" loading="lazy" />
  ) : (
    <Segnaposto ricetta={ricetta} className="miniatura" />
  );
}

export default function Copertina({
  ricetta,
  casaId,
  ricarica,
}: {
  ricetta: Ricetta;
  casaId: string;
  ricarica: () => Promise<void>;
}) {
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function scelta(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttesa(true);
    setErrore(null);
    try {
      await salvaCopertina(casaId, ricetta.id, file, ricetta.copertina_path);
      await ricarica();
    } catch (err) {
      setErrore(`Foto non salvata: ${(err as Error).message}`);
    }
    setAttesa(false);
  }

  return (
    <div className="copertina">
      {ricetta.copertina_url ? (
        <img src={ricetta.copertina_url} alt={`Foto di ${ricetta.titolo}`} />
      ) : (
        <Segnaposto ricetta={ricetta} />
      )}
      <label className={`scatta${attesa ? ' occupato' : ''}`}>
        <input type="file" accept="image/*" onChange={scelta} disabled={attesa} className="solo-lettori" />
        {attesa ? 'Carico la foto…' : ricetta.copertina_url ? 'Cambia foto' : 'Aggiungi la tua foto'}
      </label>
      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
    </div>
  );
}
