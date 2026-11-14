import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { formattaQuantitaSpesa, leggiCache, scriviCache, semplifica, type Casa, type Dati } from '../lib/dati';
import { aggiungi, elimina, spunta, usaLista, type Voce } from '../lib/lista';
import { vaiAScheda } from '../lib/rotta';

type Base = { id: string; nome: string };

/** Tiene acceso lo schermo finché `attivo` è vero; dove non è supportato non fa nulla. */
function usaSchermoAcceso(attivo: boolean) {
  useEffect(() => {
    if (!attivo || !('wakeLock' in navigator)) return;
    let blocco: WakeLockSentinel | null = null;
    let finito = false;
    const chiedi = () =>
      navigator.wakeLock.request('screen').then(
        (b) => {
          if (finito) void b.release();
          else blocco = b;
        },
        () => undefined,
      );
    // il blocco si perde quando l'app va in secondo piano: si richiede al ritorno
    const visibile = () => document.visibilityState === 'visible' && void chiedi();
    void chiedi();
    document.addEventListener('visibilitychange', visibile);
    return () => {
      finito = true;
      document.removeEventListener('visibilitychange', visibile);
      void blocco?.release();
    };
  }, [attivo]);
}

export default function Lista({ dati, casa }: { dati: Dati; casa: Casa }) {
  const lista = usaLista(casa.id);
  const [testo, setTesto] = useState('');
  const [spesa, setSpesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [base, setBase] = useState<Base[]>(() => leggiCache<Base[]>('lista.base') ?? []);
  usaSchermoAcceso(spesa);

  const catalogo = useMemo(() => new Map(dati.ingredienti.map((i) => [i.id, i])), [dati.ingredienti]);
  const nome = (v: Voce) => (v.ingrediente_id && catalogo.get(v.ingrediente_id)?.nome) || v.testo || 'Voce senza nome';

  const daComprare = lista.visibili.filter((v) => !v.spuntata);
  const nelCarrello = lista.visibili.filter((v) => v.spuntata);

  const reparti = useMemo(() => {
    const gruppi = new Map<string, { ordine: number; voci: Voce[] }>();
    for (const v of daComprare) {
      const ing = v.ingrediente_id ? catalogo.get(v.ingrediente_id) : undefined;
      const reparto = ing?.reparto ?? 'Altro';
      const gruppo = gruppi.get(reparto) ?? { ordine: ing?.ordine_reparto ?? 999, voci: [] };
      gruppo.voci.push(v);
      gruppi.set(reparto, gruppo);
    }
    return [...gruppi]
      .sort((a, b) => a[1].ordine - b[1].ordine)
      .map(([reparto, g]) => ({ reparto, voci: g.voci.sort((a, b) => nome(a).localeCompare(nome(b), 'it')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.visibili, catalogo]);

  const inLista = new Set(lista.visibili.map((v) => v.ingrediente_id));
  const daProporre = base.filter((b) => !inLista.has(b.id));

  function aggiungiVoce(e: FormEvent) {
    e.preventDefault();
    const scritto = testo.trim();
    if (!scritto) return;
    const noto = dati.ingredienti.find((i) => semplifica(i.nome) === semplifica(scritto));
    // un ingrediente già in lista e ancora da comprare non si aggiunge due volte
    const giaInLista = noto && lista.visibili.some((v) => v.ingrediente_id === noto.id && !v.spuntata);
    if (!giaInLista) aggiungi(scritto, noto?.id ?? null);
    setTesto('');
  }

  async function togli(ids: string[]) {
    setAttesa(true);
    setErrore(await elimina(ids));
    setAttesa(false);
  }

  const nascondiBase = () => {
    setBase([]);
    scriviCache('lista.base', []);
  };

  const riga = (v: Voce) => {
    const ing = v.ingrediente_id ? catalogo.get(v.ingrediente_id) : undefined;
    return (
      <li key={v.id}>
        <button className="voce" aria-pressed={v.spuntata} onClick={() => spunta(v.id, !v.spuntata)}>
          <span className="casella" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="icona" aria-hidden="true">
            {ing?.icona}
          </span>
          <span className="cosa">{nome(v)}</span>
          {v.quantita !== null && <span className="quanto">{formattaQuantitaSpesa(v.quantita, v.unita)}</span>}
        </button>
        {!spesa && (
          <button className="togli" aria-label={`Elimina ${nome(v)}`} disabled={attesa} onClick={() => togli([v.id])}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </li>
    );
  };

  const vuota = lista.visibili.length === 0;
  const sospese = lista.coda.length;

  return (
    <main className={`lista${spesa ? ' in-spesa' : ''}`}>
      <header className="home-testa">
        <h1>Lista della spesa</h1>
        {!vuota && (
          <button className="interruttore" aria-pressed={spesa} onClick={() => setSpesa(!spesa)}>
            Modalità spesa
          </button>
        )}
      </header>

      {(lista.offline || sospese > 0) && (
        <p className="stato-rete" role="status">
          {lista.offline
            ? sospese > 0
              ? `Senza connessione: ${sospese === 1 ? '1 modifica verrà inviata' : `${sospese} modifiche verranno inviate`} appena torna.`
              : 'Senza connessione: vedi l’ultima versione salvata. Le spunte funzionano lo stesso.'
            : 'Invio delle modifiche…'}
        </p>
      )}

      {errore && (
        <p role="alert" className="errore">
          {errore}
        </p>
      )}

      {!lista.pronta ? (
        <p className="nota">Carico la lista…</p>
      ) : vuota ? (
        <section className="vuoto">
          <h2>La lista è vuota</h2>
          <p>Generala dal menù della settimana, oppure aggiungi una voce qui sotto.</p>
          <button className="contorno vai-menu" onClick={() => vaiAScheda('/menu')}>
            Vai al menù
          </button>
        </section>
      ) : (
        <>
          <p className="conteggio">
            {daComprare.length === 0
              ? 'Hai preso tutto.'
              : `${daComprare.length} da comprare${nelCarrello.length ? `, ${nelCarrello.length} nel carrello` : ''}`}
          </p>

          {reparti.map((r) => (
            <section key={r.reparto} className="reparto">
              <h2>{r.reparto}</h2>
              <ul>{r.voci.map(riga)}</ul>
            </section>
          ))}

          {nelCarrello.length > 0 && (
            <section className="reparto carrello">
              <h2>Nel carrello</h2>
              <ul>{nelCarrello.map(riga)}</ul>
              {!spesa && (
                <button className="contorno" disabled={attesa} onClick={() => togli(nelCarrello.map((v) => v.id))}>
                  Svuota il carrello
                </button>
              )}
            </section>
          )}
        </>
      )}

      {!spesa && lista.pronta && (
        <>
          {daProporre.length > 0 && (
            <section className="di-base">
              <h2>Per il menù servono anche</h2>
              <p className="nota">Ingredienti di base che di solito hai già. Tocca quelli che mancano.</p>
              <div className="proposte">
                {daProporre.map((b) => (
                  <button key={b.id} className="filtro" onClick={() => aggiungi(null, b.id)}>
                    {b.nome}
                  </button>
                ))}
              </div>
              <button className="secondario" onClick={nascondiBase}>
                Li ho tutti
              </button>
            </section>
          )}

          <form onSubmit={aggiungiVoce} className="modulo aggiungi-voce">
            <label htmlFor="nuova-voce">Aggiungi una voce</label>
            <div className="riga">
              <input
                id="nuova-voce"
                enterKeyHint="done"
                placeholder="Carta forno, latte…"
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
              />
              <button type="submit" className="contorno" disabled={!testo.trim()}>
                Aggiungi
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
