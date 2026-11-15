import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { leggiPersone } from '../lib/piano';
import { tornaAllElenco, vai } from '../lib/rotta';
import ImpostaPassword from './ImpostaPassword';
import Persone from './Persone';
import type { Casa } from '../lib/dati';

/** Il nome con cui si compare agli altri della casa, per esempio sulle voci personali del menù. */
function IlMioNome({ casa, utente }: { casa: Casa; utente: string }) {
  const [nome, setNome] = useState('');
  const [stato, setStato] = useState<'fermo' | 'attesa' | 'salvato'>('fermo');
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    leggiPersone(casa.id).then(
      (p) => setNome((n) => n || (p[utente] === 'un’altra persona' ? '' : (p[utente] ?? ''))),
      () => undefined,
    );
  }, [casa.id, utente]);

  async function salva(e: FormEvent) {
    e.preventDefault();
    setStato('attesa');
    setErrore(null);
    const { error } = await supabase.rpc('imposta_nome', { p_casa: casa.id, p_nome: nome });
    if (error) setErrore(`Nome non salvato: ${error.message}`);
    setStato(error ? 'fermo' : 'salvato');
  }

  return (
    <form className="modulo il-mio-nome" onSubmit={salva}>
      <label htmlFor="mio-nome">Il tuo nome nella casa</label>
      <div className="riga">
        <input
          id="mio-nome"
          autoComplete="given-name"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setStato('fermo');
          }}
        />
        <button type="submit" className="contorno" disabled={stato === 'attesa' || !nome.trim()}>
          {stato === 'salvato' ? 'Salvato' : 'Salva'}
        </button>
      </div>
      <p className="nota">Gli altri lo vedono sulle voci del menù che sono solo tue.</p>
      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
    </form>
  );
}

export default function Impostazioni({ email, casa, utente }: { email: string; casa: Casa | undefined; utente: string }) {
  return (
    <main className="impostazioni">
      <button className="indietro secondario" onClick={tornaAllElenco}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Ricette
      </button>
      <header className="ricetta-testa">
        <h1>Impostazioni</h1>
        <p className="origine">
          Accesso come {email}
          {casa && <>, {casa.nome}</>}
        </p>
      </header>
      <button className="contorno" onClick={() => vai('/tag')}>
        Gestisci i tag
      </button>
      {casa && <IlMioNome casa={casa} utente={utente} />}
      <ImpostaPassword email={email} />
      {casa && <Persone casa={casa} email={email} />}
      <button className="esci" onClick={() => supabase.auth.signOut()}>
        Esci
      </button>
    </main>
  );
}
