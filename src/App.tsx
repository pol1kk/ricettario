import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { caricaDati, type Dati } from './lib/dati';
import { usaRotta } from './lib/rotta';
import Login from './screens/Login';
import Elenco, { FILTRI_VUOTI, type Filtri } from './screens/Elenco';
import SchedaRicetta from './screens/Ricetta';
import Impostazioni from './screens/Impostazioni';
import GestioneTag from './screens/GestioneTag';

type Stato = { tipo: 'carico' } | { tipo: 'errore'; messaggio: string } | { tipo: 'pronto'; dati: Dati };

export default function App() {
  // undefined = sessione non ancora letta; null = nessun accesso
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  return session ? <Dentro session={session} /> : <Login />;
}

function Dentro({ session }: { session: Session }) {
  const rotta = usaRotta();
  const [stato, setStato] = useState<Stato>({ tipo: 'carico' });
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_VUOTI);
  const utente = session.user.id;

  const carica = useCallback(() => {
    setStato({ tipo: 'carico' });
    caricaDati().then(
      (dati) => setStato({ tipo: 'pronto', dati }),
      (e: Error) => setStato({ tipo: 'errore', messaggio: e.message }),
    );
  }, []);

  useEffect(carica, [carica, utente]);

  // dopo una modifica: rilegge i dati senza far sparire la schermata
  const ricarica = useCallback(
    () =>
      caricaDati().then(
        (dati) => setStato({ tipo: 'pronto', dati }),
        (e: Error) => setStato({ tipo: 'errore', messaggio: e.message }),
      ),
    [],
  );

  if (rotta.vista === 'impostazioni') {
    return <Impostazioni email={session.user.email ?? ''} casa={stato.tipo === 'pronto' ? stato.dati.casa?.nome : undefined} />;
  }

  if (stato.tipo === 'carico') {
    return (
      <main>
        <p className="nota">Carico le ricette…</p>
      </main>
    );
  }

  if (stato.tipo === 'errore') {
    return (
      <main>
        <p role="alert" className="errore">
          Non riesco a leggere i dati: {stato.messaggio}. Controlla la connessione.
        </p>
        <button className="riprova" onClick={carica}>
          Riprova
        </button>
      </main>
    );
  }

  const { dati } = stato;

  if (!dati.casa) {
    return (
      <main>
        <section className="vuoto">
          <h2>Questa email non è collegata a nessuna casa</h2>
          <p>
            Hai fatto l'accesso come {session.user.email}. Chiedi un invito a chi gestisce la casa, oppure esci e
            rientra con l'email invitata.
          </p>
        </section>
        <button className="riprova" onClick={() => supabase.auth.signOut()}>
          Esci
        </button>
      </main>
    );
  }

  if (rotta.vista === 'ricetta') {
    return (
      <SchedaRicetta
        key={rotta.id}
        ricetta={dati.ricette.find((r) => r.id === rotta.id)}
        casa={dati.casa}
        tag={dati.tag}
        ricarica={ricarica}
      />
    );
  }

  if (rotta.vista === 'tag') {
    return <GestioneTag dati={dati} casa={dati.casa} ricarica={ricarica} />;
  }

  return <Elenco dati={dati} filtri={filtri} setFiltri={setFiltri} />;
}
