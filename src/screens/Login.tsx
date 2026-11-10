import { useState, type FormEvent } from 'react';
import { supabase, APP_URL } from '../lib/supabase';

type Passo = 'email' | 'codice';

export default function Login() {
  const [passo, setPasso] = useState<Passo>('email');
  const [email, setEmail] = useState('');
  const [codice, setCodice] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function inviaEmail(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: APP_URL },
    });
    setAttesa(false);
    if (error) {
      setErrore(
        error.status === 429
          ? 'Troppe richieste ravvicinate. Aspetta un minuto e riprova.'
          : `Email non inviata: ${error.message}`,
      );
      return;
    }
    setPasso('codice');
  }

  async function verificaCodice(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codice.trim(),
      type: 'email',
    });
    setAttesa(false);
    if (error) setErrore('Codice non valido o scaduto. Controlla le cifre o chiedi una nuova email.');
  }

  return (
    <main className="login">
      <header className="login-testa">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="56" height="56" />
        <h1>Ricettario</h1>
        <p>Le ricette salvate dai reel, il menù della settimana e quello che c'è in dispensa.</p>
      </header>

      {passo === 'email' ? (
        <form onSubmit={inviaEmail} className="modulo" key="email">
          <label htmlFor="email">La tua email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
          />
          <button type="submit" disabled={attesa}>
            {attesa ? 'Invio in corso…' : 'Invia email di accesso'}
          </button>
          <p className="nota">Niente password: ricevi un'email e da lì entri.</p>
        </form>
      ) : (
        <form onSubmit={verificaCodice} className="modulo" key="codice">
          <p className="conferma">
            Email inviata a <strong>{email.trim().toLowerCase()}</strong>. Apri il link che contiene, oppure
            scrivi qui il codice.
          </p>
          <label htmlFor="codice">Codice ricevuto</label>
          <input
            id="codice"
            className="codice"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            required
            value={codice}
            onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
          />
          <button type="submit" disabled={attesa}>
            {attesa ? 'Verifica in corso…' : 'Entra'}
          </button>
          <button
            type="button"
            className="secondario"
            onClick={() => {
              setPasso('email');
              setCodice('');
              setErrore(null);
            }}
          >
            Usa un'altra email
          </button>
        </form>
      )}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
    </main>
  );
}
