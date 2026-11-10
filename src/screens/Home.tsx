import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import ImpostaPassword from './ImpostaPassword';

type Tag = { id: string; nome: string; gruppo: string; ordine: number };
type Stato =
  | { tipo: 'carico' }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'senza-casa' }
  | { tipo: 'pronto'; casa: string; ricette: number; tag: Tag[] };

export default function Home({ session }: { session: Session }) {
  const [stato, setStato] = useState<Stato>({ tipo: 'carico' });

  useEffect(() => {
    let attivo = true;
    (async () => {
      const [case_, ricette, tag] = await Promise.all([
        supabase.from('case').select('nome').limit(1),
        supabase.from('ricette').select('id', { count: 'exact', head: true }),
        supabase.from('tag').select('id, nome, gruppo, ordine').order('ordine'),
      ]);
      if (!attivo) return;
      const errore = case_.error ?? ricette.error ?? tag.error;
      if (errore) return setStato({ tipo: 'errore', messaggio: errore.message });
      if (!case_.data?.length) return setStato({ tipo: 'senza-casa' });
      setStato({ tipo: 'pronto', casa: case_.data[0].nome, ricette: ricette.count ?? 0, tag: tag.data ?? [] });
    })();
    return () => {
      attivo = false;
    };
  }, [session.user.id]);

  const gruppi =
    stato.tipo === 'pronto'
      ? stato.tag.reduce<Map<string, Tag[]>>(
          (m, t) => m.set(t.gruppo, [...(m.get(t.gruppo) ?? []), t]),
          new Map(),
        )
      : null;

  return (
    <main className="home">
      <header className="home-testa">
        <h1>Ricettario</h1>
        <button className="secondario" onClick={() => supabase.auth.signOut()}>
          Esci
        </button>
      </header>

      {stato.tipo === 'carico' && <p className="nota">Carico i dati…</p>}

      {stato.tipo === 'errore' && (
        <p role="alert" className="errore">
          Non riesco a leggere i dati: {stato.messaggio}. Controlla la connessione e ricarica la pagina.
        </p>
      )}

      {stato.tipo === 'senza-casa' && (
        <section className="vuoto">
          <h2>Questa email non è collegata a nessuna casa</h2>
          <p>
            Hai fatto l'accesso come {session.user.email}. Chiedi un invito a chi gestisce la casa, oppure
            esci e rientra con l'email invitata.
          </p>
        </section>
      )}

      {stato.tipo === 'pronto' && gruppi && (
        <>
          <section className="vuoto">
            <h2>
              {stato.ricette === 0
                ? 'Nessuna ricetta, per ora'
                : stato.ricette === 1
                  ? '1 ricetta salvata'
                  : `${stato.ricette} ricette salvate`}
            </h2>
            <p>
              {stato.ricette === 0
                ? 'Scarica i reel nella cartella Ricette e scrivi a Claude «analizza i nuovi»: le ricette compariranno qui.'
                : 'L’elenco e la ricerca arrivano con la prossima fase.'}
            </p>
          </section>

          <section className="tag">
            <h2>Tag pronti all'uso</h2>
            <dl>
              {[...gruppi].map(([gruppo, lista]) => (
                <div key={gruppo}>
                  <dt>{gruppo}</dt>
                  <dd>
                    {lista.map((t) => (
                      <span key={t.id} className="chip">
                        {t.nome}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <ImpostaPassword email={session.user.email ?? ''} />

          <footer className="piede">
            {stato.casa}, accesso come {session.user.email}
          </footer>
        </>
      )}
    </main>
  );
}
