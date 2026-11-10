import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { passwordImpostata, ricordaPasswordImpostata } from '../lib/password';

const MINIMO = 8;

export default function ImpostaPassword({ email }: { email: string }) {
  const [gia, setGia] = useState(passwordImpostata);
  const [aperto, setAperto] = useState(!gia);
  const [password, setPassword] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  async function salva(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setEsito(null);
    const { error } = await supabase.auth.updateUser({ password });
    setAttesa(false);
    if (error) {
      setEsito({ ok: false, testo: `Password non salvata: ${error.message}` });
      return;
    }
    ricordaPasswordImpostata();
    setGia(true);
    setAperto(false);
    setPassword('');
    setEsito({ ok: true, testo: 'Password salvata. Ora puoi usarla per entrare da qualsiasi dispositivo.' });
  }

  if (!aperto) {
    return (
      <div className="password-chiusa">
        {esito?.ok && <p className="fatto">{esito.testo}</p>}
        <button className="secondario" onClick={() => { setAperto(true); setEsito(null); }}>
          Cambia password
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={salva} className="scheda modulo">
      <h2>{gia ? 'Cambia password' : 'Scegli una password'}</h2>
      {!gia && (
        <p className="nota">
          Serve per entrare dall'app installata nella schermata Home, dove il link via email non funziona.
        </p>
      )}
      {/* campo nascosto: permette al gestore di password di associare email e password */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <label htmlFor="nuova-password">Nuova password</label>
      <input
        id="nuova-password"
        type="password"
        autoComplete="new-password"
        minLength={MINIMO}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="nota">Almeno {MINIMO} caratteri.</p>
      <button type="submit" disabled={attesa}>
        {attesa ? 'Salvataggio…' : 'Salva password'}
      </button>
      {gia && (
        <button type="button" className="secondario" onClick={() => setAperto(false)}>
          Annulla
        </button>
      )}
      {esito && !esito.ok && (
        <p role="alert" className="errore">
          {esito.testo}
        </p>
      )}
    </form>
  );
}
