import { useState, type FormEvent } from 'react';
import { supabase, APP_URL } from '../lib/supabase';
import { ricordaPasswordImpostata } from '../lib/password';

type Modo = 'password' | 'link' | 'link-inviato';

export default function Login() {
  const [modo, setModo] = useState<Modo>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const indirizzo = email.trim().toLowerCase();

  function cambia(nuovo: Modo) {
    setModo(nuovo);
    setErrore(null);
  }

  async function entra(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const { error } = await supabase.auth.signInWithPassword({ email: indirizzo, password });
    setAttesa(false);
    if (error) {
      setErrore(
        error.status === 400
          ? 'Email o password non corrette. Se non hai ancora una password, entra con il link via email.'
          : `Accesso non riuscito: ${error.message}`,
      );
      return;
    }
    ricordaPasswordImpostata();
  }

  async function inviaLink(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: indirizzo,
      options: { emailRedirectTo: APP_URL },
    });
    setAttesa(false);
    if (error) {
      setErrore(
        error.status === 429
          ? 'Troppe richieste ravvicinate. Aspetta qualche minuto e riprova.'
          : `Email non inviata: ${error.message}`,
      );
      return;
    }
    setModo('link-inviato');
  }

  const campoEmail = (
    <>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nome@esempio.it"
      />
    </>
  );

  return (
    <main className="login">
      <header className="login-testa">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="56" height="56" />
        <h1>Ricettario</h1>
        <p>Le ricette salvate dai reel, il menù della settimana e quello che c'è in dispensa.</p>
      </header>

      {modo === 'password' && (
        <form onSubmit={entra} className="modulo" key="password">
          {campoEmail}
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={attesa}>
            {attesa ? 'Accesso in corso…' : 'Entra'}
          </button>
          <button type="button" className="secondario" onClick={() => cambia('link')}>
            Primo accesso o password dimenticata
          </button>
        </form>
      )}

      {modo === 'link' && (
        <form onSubmit={inviaLink} className="modulo" key="link">
          <p className="conferma">
            Ricevi un link via email, aprilo e poi scegli una password dalla schermata iniziale.
          </p>
          {campoEmail}
          <button type="submit" disabled={attesa}>
            {attesa ? 'Invio in corso…' : 'Invia link di accesso'}
          </button>
          <button type="button" className="secondario" onClick={() => cambia('password')}>
            Ho già una password
          </button>
        </form>
      )}

      {modo === 'link-inviato' && (
        <div className="modulo" key="inviato">
          <p className="conferma">
            Email inviata a <strong>{indirizzo}</strong>. Apri il link dal browser di questo dispositivo.
          </p>
          <p className="nota">
            Il link apre il browser, non l'app installata nella schermata Home. Per entrare da lì scegli una
            password dopo l'accesso e usala nell'app.
          </p>
          <button type="button" className="secondario" onClick={() => cambia('password')}>
            Torna all'accesso con password
          </button>
        </div>
      )}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}
    </main>
  );
}
