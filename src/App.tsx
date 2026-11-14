import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { caricaDati, leggiCache, scriviCache, type Dati } from './lib/dati';
import { lunedi, oggi } from './lib/date';
import { PRINCIPALI, usaRotta } from './lib/rotta';
import Login from './screens/Login';
import Elenco, { FILTRI_VUOTI, type Filtri } from './screens/Elenco';
import SchedaRicetta from './screens/Ricetta';
import Impostazioni from './screens/Impostazioni';
import GestioneTag from './screens/GestioneTag';
import Menu from './screens/Menu';
import Lista from './screens/Lista';
import Barra from './screens/Barra';

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
  // Si parte dalla copia salvata sul telefono, se c'è: l'app si apre subito e funziona anche senza rete.
  const [stato, setStato] = useState<Stato>(() => {
    const copia = leggiCache<{ utente: string; dati: Dati }>('dati');
    return copia && copia.utente === session.user.id ? { tipo: 'pronto', dati: copia.dati } : { tipo: 'carico' };
  });
  const [nonAggiornati, setNonAggiornati] = useState(false);
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_VUOTI);
  const [settimana, setSettimana] = useState(() => lunedi(oggi()));
  const utente = session.user.id;

  // Rilegge i dati. Se non riesce e c'è già qualcosa a schermo, lo lascia e segnala che non è aggiornato.
  const ricarica = useCallback(
    () =>
      caricaDati().then(
        (dati) => {
          setStato({ tipo: 'pronto', dati });
          setNonAggiornati(false);
          scriviCache('dati', { utente, dati });
        },
        (e: Error) => {
          setStato((prima) => (prima.tipo === 'pronto' ? prima : { tipo: 'errore', messaggio: e.message }));
          setNonAggiornati(true);
        },
      ),
    [utente],
  );

  useEffect(() => {
    void ricarica();
    const riprova = () => void ricarica();
    window.addEventListener('online', riprova);
    return () => window.removeEventListener('online', riprova);
  }, [ricarica]);

  const casa = stato.tipo === 'pronto' ? (stato.dati.casa ?? undefined) : undefined;

  if (rotta.vista === 'impostazioni') {
    return <Impostazioni email={session.user.email ?? ''} casa={casa} />;
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
        <button
          className="riprova"
          onClick={() => {
            setStato({ tipo: 'carico' });
            void ricarica();
          }}
        >
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

  return (
    <div className={PRINCIPALI.includes(rotta.vista) ? 'con-barra' : undefined}>
      {nonAggiornati && rotta.vista === 'elenco' && (
        <p className="stato-rete in-cima" role="status">
          Senza connessione: vedi le ricette salvate l'ultima volta.
        </p>
      )}
      {rotta.vista === 'menu' ? (
        <Menu dati={dati} casa={dati.casa} settimana={settimana} setSettimana={setSettimana} />
      ) : rotta.vista === 'lista' ? (
        <Lista dati={dati} casa={dati.casa} />
      ) : (
        <Elenco dati={dati} filtri={filtri} setFiltri={setFiltri} />
      )}
      <Barra vista={rotta.vista} />
    </div>
  );
}
