import { useMemo, useState, type FormEvent } from 'react';
import { semplifica, type Casa, type Dati, type Ingrediente, type Unita } from '../lib/dati';
import { creaIngrediente, type DatiProdotto } from '../lib/dispensa';

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ingredienti del catalogo il cui nome compare tutto nel nome del prodotto, dal più specifico. */
export function ingredientiSimili(nomeProdotto: string, catalogo: Ingrediente[]): Ingrediente[] {
  const testo = ` ${semplifica(nomeProdotto)} `;
  return catalogo
    .filter((i) => {
      const parole = semplifica(i.nome).split(/\s+/).filter((p) => p.length > 2);
      return parole.length > 0 && parole.every((p) => testo.includes(p.slice(0, Math.max(3, p.length - 1))));
    })
    .sort((a, b) => b.nome.length - a.nome.length)
    .slice(0, 4);
}

/** Cerca un ingrediente del catalogo, oppure ne crea uno nuovo. */
export default function ScegliIngrediente({
  dati,
  casa,
  suggeriti = [],
  nomeNuovo = '',
  valoriNuovo,
  unitaNuovo,
  ricarica,
  scegli,
}: {
  dati: Dati;
  casa: Casa;
  suggeriti?: Ingrediente[];
  /** nome proposto per un ingrediente nuovo (di solito quello del prodotto scansionato) */
  nomeNuovo?: string;
  valoriNuovo?: DatiProdotto;
  unitaNuovo?: Unita;
  ricarica: () => Promise<void>;
  scegli: (i: Ingrediente) => void;
}) {
  const [testo, setTesto] = useState('');
  const [nuovo, setNuovo] = useState(false);
  const [nome, setNome] = useState(nomeNuovo);
  const [unita, setUnita] = useState<Unita>(unitaNuovo ?? 'g');
  const [reparto, setReparto] = useState(() => dati.reparti.find((r) => r.nome === 'Altro')?.id ?? dati.reparti[0]?.id ?? '');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const trovati = useMemo(() => {
    const parole = semplifica(testo).split(/\s+/).filter(Boolean);
    if (parole.length === 0) return [];
    return dati.ingredienti.filter((i) => parole.every((p) => semplifica(i.nome).includes(p))).slice(0, 30);
  }, [dati.ingredienti, testo]);

  async function crea(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setAttesa(true);
    setErrore(null);
    try {
      const id = await creaIngrediente(casa.id, { nome, unita_base: unita, reparto_id: reparto || null, valori: valoriNuovo });
      const rep = dati.reparti.find((r) => r.id === reparto);
      const conValori = unita !== 'unita' && valoriNuovo;
      void ricarica();
      scegli({
        id,
        nome: nome.trim().toLowerCase(),
        icona: null,
        base: false,
        reparto: rep?.nome ?? null,
        ordine_reparto: rep?.ordine ?? 999,
        unita_base: unita,
        kcal_100: conValori ? valoriNuovo.kcal_100 : null,
        proteine_100: conValori ? valoriNuovo.proteine_100 : null,
        carboidrati_100: conValori ? valoriNuovo.carboidrati_100 : null,
        grassi_100: conValori ? valoriNuovo.grassi_100 : null,
        grammi_per_unita: null,
      });
    } catch (err) {
      setErrore((err as Error).message);
      setAttesa(false);
    }
  }

  const riga = (i: Ingrediente) => (
    <li key={i.id}>
      <button onClick={() => scegli(i)}>
        <span className="icona-alimento" aria-hidden="true">
          {i.icona}
        </span>
        <span className="testi">
          <span className="titolo">{maiuscola(i.nome)}</span>
          {i.reparto && <span className="dettagli">{i.reparto}</span>}
        </span>
      </button>
    </li>
  );

  if (nuovo) {
    return (
      <form className="modulo nuovo-ingrediente" onSubmit={crea}>
        <label htmlFor="ni-nome">Nome dell’ingrediente</label>
        <input id="ni-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <p className="nota">Un nome generico, senza marca: «latte intero», non il nome del prodotto.</p>
        <label htmlFor="ni-unita">Come lo misuri</label>
        <select id="ni-unita" value={unita} onChange={(e) => setUnita(e.target.value as Unita)}>
          <option value="g">A peso (grammi)</option>
          <option value="ml">A volume (millilitri)</option>
          <option value="unita">A pezzi</option>
        </select>
        <label htmlFor="ni-reparto">Reparto</label>
        <select id="ni-reparto" value={reparto} onChange={(e) => setReparto(e.target.value)}>
          {dati.reparti.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
        {errore && (
          <p role="alert" className="errore">
            {errore}
          </p>
        )}
        <button type="submit" disabled={attesa || !nome.trim()}>
          {attesa ? 'Un momento…' : 'Crea l’ingrediente'}
        </button>
        <button type="button" className="secondario" onClick={() => setNuovo(false)}>
          Cerca tra quelli esistenti
        </button>
      </form>
    );
  }

  return (
    <div className="scegli-ingrediente">
      {suggeriti.length > 0 && testo === '' && (
        <>
          <h2>Potrebbe essere</h2>
          <ul className="ricette scelta semplice">{suggeriti.map(riga)}</ul>
        </>
      )}
      <div className="ricerca">
        <label htmlFor="cerca-ingrediente">{suggeriti.length > 0 ? 'Oppure cerca un ingrediente' : 'Cerca un ingrediente'}</label>
        <input id="cerca-ingrediente" type="search" placeholder="Latte, riso, tonno…" value={testo} onChange={(e) => setTesto(e.target.value)} />
      </div>
      {trovati.length > 0 && <ul className="ricette scelta semplice">{trovati.map(riga)}</ul>}
      {testo.trim() !== '' && trovati.length === 0 && <p className="nota">Nessun ingrediente con questo nome.</p>}
      <button
        className="contorno crea-ingrediente"
        onClick={() => {
          if (testo.trim()) setNome(testo.trim());
          setNuovo(true);
        }}
      >
        {testo.trim() ? `Crea «${testo.trim()}» come nuovo ingrediente` : 'Crea un nuovo ingrediente'}
      </button>
    </div>
  );
}
