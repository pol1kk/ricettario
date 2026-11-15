import { useEffect, useMemo, useState } from 'react';
import type { Casa, Dati } from '../lib/dati';
import { elimina, sincronizza, type Voce } from '../lib/lista';
import { vaiAScheda } from '../lib/rotta';
import ModuloConfezione from './ModuloConfezione';

/**
 * Dopo la spesa: passa una alla volta le voci nel carrello per metterle in dispensa.
 * Le voci scritte a mano senza ingrediente (carta forno, detersivo) non vanno in dispensa: si tolgono e basta.
 */
export default function FineSpesa({ dati, casa, carrello, chiudi }: { dati: Dati; casa: Casa; carrello: Voce[]; chiudi: () => void }) {
  const catalogo = useMemo(() => new Map(dati.ingredienti.map((i) => [i.id, i])), [dati.ingredienti]);
  // l'elenco si fissa all'inizio: le voci spariscono dalla lista man mano che vengono sistemate
  const [voci] = useState(() => carrello.filter((v) => v.ingrediente_id && catalogo.has(v.ingrediente_id)));
  const [altre] = useState(() => carrello.filter((v) => !v.ingrediente_id || !catalogo.has(v.ingrediente_id)));
  const [indice, setIndice] = useState(0);
  const [messe, setMesse] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);

  const voce = voci[indice];

  // carrello con sole voci scritte a mano: non c'è niente da passare, si tolgono subito
  useEffect(() => {
    if (voci.length === 0 && altre.length > 0) void elimina(altre.map((v) => v.id)).then((problema) => problema && setErrore(problema));
  }, [voci, altre]);

  async function avanti(messa: boolean) {
    if (messa) setMesse((n) => n + 1);
    if (indice + 1 >= voci.length) {
      // finito il giro: le voci senza ingrediente escono dalla lista
      const problema = await elimina(altre.map((v) => v.id));
      if (problema) setErrore(problema);
    }
    void sincronizza();
    setIndice(indice + 1);
    window.scrollTo(0, 0);
  }

  async function salta() {
    const problema = await elimina([voce.id]);
    if (problema) {
      setErrore(problema);
      return;
    }
    void avanti(false);
  }

  if (voce) {
    const ingrediente = catalogo.get(voce.ingrediente_id!)!;
    // la quantità in lista è quella che serviva: si propone per eccesso, la confezione vera la corregge
    const proposta = voce.quantita === null ? null : ingrediente.unita_base === 'unita' ? Math.ceil(voce.quantita - 1e-9) : Math.ceil(voce.quantita / 10 - 1e-9) * 10;
    return (
      <>
        {errore && (
          <p role="alert" className="errore in-cima">
            {errore}
          </p>
        )}
        <ModuloConfezione
          key={voce.id}
          casa={casa}
          ingrediente={ingrediente}
          quantitaProposta={proposta}
          voceLista={voce.id}
          intestazione={`Metti via la spesa, ${indice + 1} di ${voci.length}`}
          fatto={() => void avanti(true)}
          salta={() => void salta()}
          annulla={chiudi}
        />
      </>
    );
  }

  return (
    <main className="fine-spesa">
      <section className="vuoto">
        <h2>Spesa sistemata</h2>
        <p>
          {messe === 0
            ? 'Non hai messo niente in dispensa.'
            : messe === 1
              ? 'Hai messo in dispensa 1 prodotto.'
              : `Hai messo in dispensa ${messe} prodotti.`}
          {altre.length > 0 && ' Le voci che non sono ingredienti le ho tolte dalla lista.'}
        </p>
        {errore && (
          <p role="alert" className="errore">
            {errore}
          </p>
        )}
        <button
          onClick={() => {
            chiudi();
            vaiAScheda('/dispensa');
          }}
        >
          Vai alla dispensa
        </button>
        <button className="secondario" onClick={chiudi}>
          Torna alla lista
        </button>
      </section>
    </main>
  );
}
