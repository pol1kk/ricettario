import { useState } from 'react';
import type { Casa, Dati, Ingrediente } from '../lib/dati';
import { cercaProdotto, cercaSuOpenFoodFacts, posizioneAbituale, salvaProdotto, type DatiProdotto, type Prodotto } from '../lib/dispensa';
import ModuloConfezione, { IconaCodice } from './ModuloConfezione';
import Scanner from './Scanner';
import ScegliIngrediente, { ingredientiSimili } from './ScegliIngrediente';

const SENZA_DATI: DatiProdotto = {
  nome: '',
  marca: null,
  formato_quantita: null,
  formato_unita: null,
  kcal_100: null,
  proteine_100: null,
  carboidrati_100: null,
  grassi_100: null,
};

type Passo =
  | { tipo: 'scegli' }
  | { tipo: 'scanner' }
  | { tipo: 'cerco' }
  /** codice mai visto: va detto a quale ingrediente corrisponde */
  | { tipo: 'collega'; codice: string; trovato: DatiProdotto | null }
  | { tipo: 'confezione'; ingrediente: Ingrediente; prodotto: Prodotto | null };

/** Aggiunge un prodotto alla dispensa fuori dalla spesa: scansionandolo oppure cercando l'ingrediente. */
export default function AggiungiADispensa({
  dati,
  casa,
  daScanner,
  ricarica,
  chiudi,
}: {
  dati: Dati;
  casa: Casa;
  /** apre subito la fotocamera */
  daScanner: boolean;
  ricarica: () => Promise<void>;
  chiudi: (aggiunto: boolean) => void;
}) {
  const [passo, setPasso] = useState<Passo>(daScanner ? { tipo: 'scanner' } : { tipo: 'scegli' });
  const [errore, setErrore] = useState<string | null>(null);

  async function codiceLetto(codice: string) {
    setPasso({ tipo: 'cerco' });
    setErrore(null);
    try {
      const noto = await cercaProdotto(casa.id, codice);
      const ingrediente = noto && dati.ingredienti.find((i) => i.id === noto.ingrediente_id);
      if (noto && ingrediente) {
        setPasso({ tipo: 'confezione', ingrediente, prodotto: noto });
        return;
      }
      const trovato = await cercaSuOpenFoodFacts(codice).catch(() => null);
      setPasso({ tipo: 'collega', codice, trovato });
    } catch (e) {
      setErrore(`Non sono riuscito a cercare il prodotto: ${(e as Error).message}. Controlla la connessione.`);
      setPasso({ tipo: 'scegli' });
    }
  }

  async function collega(codice: string, trovato: DatiProdotto | null, ingrediente: Ingrediente) {
    setErrore(null);
    try {
      const nome = trovato?.nome || ingrediente.nome.charAt(0).toUpperCase() + ingrediente.nome.slice(1);
      const prodotto = await salvaProdotto(casa.id, codice, ingrediente.id, { ...(trovato ?? SENZA_DATI), nome }, posizioneAbituale(ingrediente));
      setPasso({ tipo: 'confezione', ingrediente, prodotto });
    } catch (e) {
      setErrore(`Prodotto non salvato: ${(e as Error).message}`);
    }
  }

  if (passo.tipo === 'scanner') return <Scanner trovato={codiceLetto} chiudi={() => (daScanner ? chiudi(false) : setPasso({ tipo: 'scegli' }))} />;

  if (passo.tipo === 'confezione') {
    return (
      <ModuloConfezione
        key={passo.ingrediente.id}
        casa={casa}
        ingrediente={passo.ingrediente}
        prodottoIniziale={passo.prodotto}
        fatto={() => chiudi(true)}
        annulla={() => setPasso({ tipo: 'scegli' })}
      />
    );
  }

  const indietro = (
    <div className="barra">
      <button className="indietro secondario" onClick={() => (passo.tipo === 'collega' ? setPasso({ tipo: 'scegli' }) : chiudi(false))}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {passo.tipo === 'collega' ? 'Indietro' : 'Dispensa'}
      </button>
    </div>
  );

  if (passo.tipo === 'cerco') {
    return (
      <main className="aggiungi-dispensa">
        {indietro}
        <p className="nota">Cerco il prodotto…</p>
      </main>
    );
  }

  if (passo.tipo === 'collega') {
    const { codice, trovato } = passo;
    return (
      <main className="aggiungi-dispensa">
        {indietro}
        <header className="ricetta-testa">
          <h1>{trovato?.nome || 'Prodotto nuovo'}</h1>
          <p className="origine">
            {trovato
              ? [trovato.marca, trovato.formato_quantita && `${trovato.formato_quantita} ${trovato.formato_unita}`].filter(Boolean).join(', ') ||
                `Codice ${codice}`
              : `Il codice ${codice} non è nell’archivio dei prodotti.`}
          </p>
        </header>
        <p className="nota spiegazione">A quale ingrediente corrisponde? Lo chiedo solo la prima volta: poi questo codice lo riconosco da solo.</p>
        {errore && (
          <p role="alert" className="errore">
            {errore}
          </p>
        )}
        <ScegliIngrediente
          dati={dati}
          casa={casa}
          suggeriti={trovato?.nome ? ingredientiSimili(trovato.nome, dati.ingredienti) : []}
          nomeNuovo={trovato?.nome.toLowerCase() ?? ''}
          valoriNuovo={trovato ?? undefined}
          unitaNuovo={trovato?.formato_unita ?? undefined}
          ricarica={ricarica}
          scegli={(i) => void collega(codice, trovato, i)}
        />
      </main>
    );
  }

  return (
    <main className="aggiungi-dispensa">
      {indietro}
      <header className="ricetta-testa">
        <h1>Aggiungi alla dispensa</h1>
      </header>
      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
      <button className="contorno scansiona" onClick={() => setPasso({ tipo: 'scanner' })}>
        <IconaCodice />
        Scansiona il codice a barre
      </button>
      <ScegliIngrediente dati={dati} casa={casa} ricarica={ricarica} scegli={(i) => setPasso({ tipo: 'confezione', ingrediente: i, prodotto: null })} />
    </main>
  );
}
