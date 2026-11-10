import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Casa, Dati, Tag } from '../lib/dati';
import { tornaAllElenco } from '../lib/rotta';

type Props = { dati: Dati; casa: Casa; ricarica: () => Promise<void> };

const messaggio = (e: { code?: string; message: string }) =>
  e.code === '23505' ? 'Esiste già un tag con questo nome.' : e.message;

function SceltaGruppo({ gruppi, valore, cambia, id }: { gruppi: string[]; valore: string; cambia: (v: string) => void; id: string }) {
  const nuovo = !gruppi.includes(valore);
  return (
    <>
      <label htmlFor={id}>Gruppo</label>
      <select id={id} value={nuovo ? '' : valore} onChange={(e) => cambia(e.target.value)}>
        {gruppi.map((g) => (
          <option key={g}>{g}</option>
        ))}
        <option value="">Nuovo gruppo…</option>
      </select>
      {nuovo && (
        <input aria-label="Nome del nuovo gruppo" placeholder="Nome del nuovo gruppo" required value={valore} onChange={(e) => cambia(e.target.value)} />
      )}
    </>
  );
}

function Editor({ tag, dati, casa, ricarica, chiudi }: Props & { tag: Tag; chiudi: () => void }) {
  const gruppi = [...new Set(dati.tag.map((t) => t.gruppo))];
  const assegnate = dati.ricette.filter((r) => r.tag.some((t) => t.id === tag.id)).map((r) => r.id);
  const [nome, setNome] = useState(tag.nome);
  const [gruppo, setGruppo] = useState(tag.gruppo);
  const [ricette, setRicette] = useState(() => new Set(assegnate));
  const [soglia, setSoglia] = useState(String(casa.soglia_veloce_minuti));
  const [verso, setVerso] = useState('');
  const [conferma, setConferma] = useState<'unisci' | 'elimina' | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const altri = dati.tag.filter((t) => t.id !== tag.id && !t.automatico);

  async function esegui(azione: () => Promise<{ code?: string; message: string } | null>) {
    setAttesa(true);
    setErrore(null);
    const e = await azione();
    if (e) {
      setAttesa(false);
      setErrore(messaggio(e));
      return;
    }
    await ricarica();
    chiudi();
  }

  const salva = (e: FormEvent) => {
    e.preventDefault();
    esegui(async () => {
      const a = await supabase.from('tag').update({ nome: nome.trim(), gruppo: gruppo.trim() }).eq('id', tag.id);
      if (a.error) return a.error;
      if (tag.automatico) {
        const minuti = Math.max(1, Math.round(Number(soglia)) || casa.soglia_veloce_minuti);
        return (await supabase.from('case').update({ soglia_veloce_minuti: minuti }).eq('id', casa.id)).error;
      }
      const daTogliere = assegnate.filter((id) => !ricette.has(id));
      const daAggiungere = [...ricette].filter((id) => !assegnate.includes(id));
      if (daTogliere.length) {
        const b = await supabase.from('ricetta_tag').delete().eq('tag_id', tag.id).in('ricetta_id', daTogliere);
        if (b.error) return b.error;
      }
      if (daAggiungere.length) {
        const c = await supabase
          .from('ricetta_tag')
          .insert(daAggiungere.map((ricetta_id) => ({ ricetta_id, tag_id: tag.id, casa_id: casa.id })));
        if (c.error) return c.error;
      }
      return null;
    });
  };

  return (
    <form onSubmit={salva} className="scheda modulo editor-tag">
      <label htmlFor="t-nome">Nome</label>
      <input id="t-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
      <SceltaGruppo id="t-gruppo" gruppi={gruppi} valore={gruppo} cambia={setGruppo} />

      {tag.automatico ? (
        <>
          <label htmlFor="t-soglia">Vale per le ricette fino a (minuti)</label>
          <input id="t-soglia" inputMode="numeric" required value={soglia} onChange={(e) => setSoglia(e.target.value)} />
          <p className="nota">Questo tag non si assegna a mano: lo ricevono da sole le ricette abbastanza rapide.</p>
        </>
      ) : (
        dati.ricette.length > 0 && (
          <fieldset className="scelta-ricette">
            <legend>Ricette con questo tag</legend>
            {dati.ricette.map((r) => (
              <label key={r.id} className="spunta">
                <input
                  type="checkbox"
                  checked={ricette.has(r.id)}
                  onChange={() => {
                    const nuovo = new Set(ricette);
                    if (!nuovo.delete(r.id)) nuovo.add(r.id);
                    setRicette(nuovo);
                  }}
                />
                <span>{r.titolo}</span>
              </label>
            ))}
          </fieldset>
        )
      )}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      <div className="azioni">
        <button type="submit" disabled={attesa}>
          {attesa ? 'Salvataggio…' : 'Salva'}
        </button>
        <button type="button" className="secondario" onClick={chiudi} disabled={attesa}>
          Annulla
        </button>
      </div>

      {!tag.automatico && (
        <div className="pericolo">
          {altri.length > 0 && (
            <>
              <label htmlFor="t-verso">Unisci a un altro tag</label>
              <div className="riga">
                <select id="t-verso" value={verso} onChange={(e) => { setVerso(e.target.value); setConferma(null); }}>
                  <option value="">Scegli il tag…</option>
                  {altri.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="contorno"
                  disabled={!verso || attesa}
                  onClick={() =>
                    conferma === 'unisci'
                      ? esegui(async () => (await supabase.rpc('unisci_tag', { p_da: tag.id, p_verso: verso })).error)
                      : setConferma('unisci')
                  }
                >
                  {conferma === 'unisci' ? 'Conferma' : 'Unisci'}
                </button>
              </div>
              {conferma === 'unisci' && (
                <p className="nota">
                  Le ricette di «{tag.nome}» passano a «{altri.find((t) => t.id === verso)?.nome}» e «{tag.nome}» viene
                  eliminato.
                </p>
              )}
            </>
          )}
          <button
            type="button"
            className="contorno rosso"
            disabled={attesa}
            onClick={() =>
              conferma === 'elimina'
                ? esegui(async () => (await supabase.from('tag').delete().eq('id', tag.id)).error)
                : setConferma('elimina')
            }
          >
            {conferma === 'elimina'
              ? assegnate.length
                ? `Conferma: sparisce da ${assegnate.length} ${assegnate.length === 1 ? 'ricetta' : 'ricette'}`
                : 'Conferma eliminazione'
              : 'Elimina tag'}
          </button>
        </div>
      )}
    </form>
  );
}

function Nuovo({ dati, casa, ricarica, chiudi }: Props & { chiudi: () => void }) {
  const gruppi = [...new Set(dati.tag.map((t) => t.gruppo))];
  const [nome, setNome] = useState('');
  const [gruppo, setGruppo] = useState(gruppi[0] ?? '');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const ordine = Math.max(0, ...dati.tag.filter((t) => t.gruppo === gruppo.trim()).map((t) => t.ordine), ...(gruppi.includes(gruppo.trim()) ? [] : dati.tag.map((t) => t.ordine))) + 5;
    const { error } = await supabase.from('tag').insert({ casa_id: casa.id, nome: nome.trim(), gruppo: gruppo.trim(), ordine });
    if (error) {
      setAttesa(false);
      setErrore(messaggio(error));
      return;
    }
    await ricarica();
    chiudi();
  }

  return (
    <form onSubmit={crea} className="scheda modulo editor-tag">
      <label htmlFor="n-nome">Nome del nuovo tag</label>
      <input id="n-nome" required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
      <SceltaGruppo id="n-gruppo" gruppi={gruppi} valore={gruppo} cambia={setGruppo} />
      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
      <div className="azioni">
        <button type="submit" disabled={attesa}>
          {attesa ? 'Creazione…' : 'Crea tag'}
        </button>
        <button type="button" className="secondario" onClick={chiudi} disabled={attesa}>
          Annulla
        </button>
      </div>
    </form>
  );
}

export default function GestioneTag(props: Props) {
  const { dati } = props;
  const [aperto, setAperto] = useState<string | null>(null);
  const gruppi = [...new Set(dati.tag.map((t) => t.gruppo))];
  const conta = (id: string) => dati.ricette.filter((r) => r.tag.some((t) => t.id === id)).length;

  return (
    <main className="gestione-tag">
      <button className="indietro secondario" onClick={tornaAllElenco}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Ricette
      </button>
      <header className="ricetta-testa">
        <h1>Tag</h1>
        <p className="origine">Tocca un tag per rinominarlo, spostarlo, unirlo a un altro o scegliere le ricette che lo usano.</p>
      </header>

      {aperto === 'nuovo' ? (
        <Nuovo {...props} chiudi={() => setAperto(null)} />
      ) : (
        <button className="contorno nuovo-tag" onClick={() => setAperto('nuovo')}>
          Nuovo tag
        </button>
      )}

      {gruppi.map((g) => (
        <section key={g} className="gruppo-tag">
          <h2>{g}</h2>
          <ul>
            {dati.tag
              .filter((t) => t.gruppo === g)
              .map((t) => (
                <li key={t.id}>
                  <button className="riga-tag" aria-expanded={aperto === t.id} onClick={() => setAperto(aperto === t.id ? null : t.id)}>
                    <span>{t.nome}</span>
                    <span className="quante">{t.automatico ? `automatico, ${conta(t.id)}` : conta(t.id)}</span>
                  </button>
                  {aperto === t.id && <Editor key={t.id} {...props} tag={t} chiudi={() => setAperto(null)} />}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
