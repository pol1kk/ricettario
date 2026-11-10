import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, APP_URL } from '../lib/supabase';
import type { Casa } from '../lib/dati';

type Persona = { email: string; ruolo: 'proprietario' | 'membro'; in_attesa: boolean };

export default function Persone({ casa, email }: { casa: Casa; email: string }) {
  const [persone, setPersone] = useState<Persona[] | null>(null);
  const [nuova, setNuova] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [copiato, setCopiato] = useState(false);

  const carica = useCallback(async () => {
    const { data, error } = await supabase.rpc('persone_casa', { p_casa: casa.id });
    if (!error) setPersone((data ?? []) as Persona[]);
  }, [casa.id]);

  useEffect(() => {
    carica();
  }, [carica]);

  const gestisco = persone?.some((p) => p.email === email && p.ruolo === 'proprietario') ?? false;

  async function invita(e: FormEvent) {
    e.preventDefault();
    setAttesa(true);
    setEsito(null);
    const indirizzo = nuova.trim().toLowerCase();
    const { data, error } = await supabase.rpc('invita_in_casa', { p_casa: casa.id, p_email: indirizzo });
    setAttesa(false);
    if (error) {
      setEsito({ ok: false, testo: error.message });
      return;
    }
    setNuova('');
    setEsito({
      ok: true,
      testo:
        data === 'aggiunto'
          ? `${indirizzo} aveva già un account: ora vede questa casa.`
          : `Invito registrato per ${indirizzo}. Mandale l'indirizzo dell'app: la prima volta entra da «Primo accesso o password dimenticata» con questa email.`,
    });
    carica();
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      setEsito({ ok: false, testo: `Copia non riuscita. L'indirizzo è ${APP_URL}` });
    }
  }

  return (
    <section className="persone" aria-labelledby="t-persone">
      <h2 id="t-persone">Persone di {casa.nome}</h2>
      <p className="nota">Chi fa parte della casa vede e modifica le stesse ricette.</p>

      {persone && (
        <ul>
          {persone.map((p) => (
            <li key={p.email}>
              <span className="chi">{p.email}</span>
              <span className="stato">
                {p.in_attesa ? 'invitata, non ancora entrata' : p.ruolo === 'proprietario' ? 'gestisce la casa' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {gestisco && (
        <form onSubmit={invita} className="modulo">
          <label htmlFor="invito">Invita con l'email</label>
          <div className="riga">
            <input
              id="invito"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              required
              placeholder="nome@esempio.it"
              value={nuova}
              onChange={(e) => setNuova(e.target.value)}
            />
            <button type="submit" className="contorno" disabled={attesa}>
              {attesa ? 'Invio…' : 'Invita'}
            </button>
          </div>
        </form>
      )}

      {esito && (
        <p role={esito.ok ? 'status' : 'alert'} className={esito.ok ? 'fatto' : 'errore'}>
          {esito.testo}
        </p>
      )}

      <button className="secondario copia" onClick={copia}>
        {copiato ? 'Indirizzo copiato' : "Copia l'indirizzo dell'app"}
      </button>
    </section>
  );
}
