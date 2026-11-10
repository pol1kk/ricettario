import { supabase } from '../lib/supabase';
import { tornaAllElenco, vai } from '../lib/rotta';
import ImpostaPassword from './ImpostaPassword';

export default function Impostazioni({ email, casa }: { email: string; casa: string | undefined }) {
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
          {casa && <>, {casa}</>}
        </p>
      </header>
      <button className="contorno" onClick={() => vai('/tag')}>
        Gestisci i tag
      </button>
      <ImpostaPassword email={email} />
      <button className="esci" onClick={() => supabase.auth.signOut()}>
        Esci
      </button>
    </main>
  );
}
