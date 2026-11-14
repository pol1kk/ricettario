import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { formattaQuantitaSpesa, leggiCache, scriviCache, semplifica, type Casa, type Dati } from '../lib/dati';
import { aggiungi, elimina, sposta, spunta, usaLista, type Voce } from '../lib/lista';
import { supabase } from '../lib/supabase';
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
  const [repartoScelto, setRepartoScelto] = useState<string | null>(null);
  const [inSpostamento, setInSpostamento] = useState<string | null>(null);
  // scelte fatte in questa sessione, in aggiunta a quelle già salvate
  const [ricordate, setRicordate] = useState<Record<string, string>>({});
  usaSchermoAcceso(spesa);

  const catalogo = useMemo(() => new Map(dati.ingredienti.map((i) => [i.id, i])), [dati.ingredienti]);
  const reparti = dati.reparti ?? [];
  const repartoPerId = useMemo(() => new Map((dati.reparti ?? []).map((r) => [r.id, r])), [dati.reparti]);
  const altro = reparti.find((r) => r.nome === 'Altro')?.id ?? null;

  // voce scritta a mano che non corrisponde a un ingrediente: le serve un reparto
  const scritto = testo.trim();
  const noto = scritto ? dati.ingredienti.find((i) => semplifica(i.nome) === semplifica(scritto)) : undefined;
  const ricordato = { ...(dati.ricordate ?? {}), ...ricordate }[scritto.toLowerCase()] ?? null;
  const repartoNuovaVoce = repartoScelto ?? ricordato ?? altro;

  /** Salva la scelta del reparto per la prossima volta; se non c'è rete pazienza, vale solo per questa voce. */
  function ricorda(voce: string, repartoId: string) {
    const chiave = voce.trim().toLowerCase();
    if (!chiave) return;
    setRicordate((r) => ({ ...r, [chiave]: repartoId }));
    void supabase
      .from('voci_ricordate')
      .upsert({ casa_id: casa.id, testo: chiave, reparto_id: repartoId, aggiornata_il: new Date().toISOString() })
      .then(() => undefined);
  }
  const nome = (v: Voce) => (v.ingrediente_id && catalogo.get(v.ingrediente_id)?.nome) || v.testo || 'Voce senza nome';

  const daComprare = lista.visibili.filter((v) => !v.spuntata);
  const nelCarrello = lista.visibili.filter((v) => v.spuntata);

  const gruppiReparto = useMemo(() => {
    const gruppi = new Map<string, { ordine: number; voci: Voce[] }>();
    for (const v of daComprare) {
      const ing = v.ingrediente_id ? catalogo.get(v.ingrediente_id) : undefined;
      const scelto = !ing && v.reparto_id ? repartoPerId.get(v.reparto_id) : undefined;
      const reparto = ing?.reparto ?? scelto?.nome ?? 'Altro';
      const gruppo = gruppi.get(reparto) ?? { ordine: ing?.ordine_reparto ?? scelto?.ordine ?? 999, voci: [] };
      gruppo.voci.push(v);
      gruppi.set(reparto, gruppo);
    }
    return [...gruppi]
      .sort((a, b) => a[1].ordine - b[1].ordine)
      .map(([reparto, g]) => ({ reparto, voci: g.voci.sort((a, b) => nome(a).localeCompare(nome(b), 'it')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.visibili, catalogo, repartoPerId]);

  const inLista = new Set(lista.visibili.map((v) => v.ingrediente_id));
  const daProporre = base.filter((b) => !inLista.has(b.id));

  function aggiungiVoce(e: FormEvent) {
    e.preventDefault();
    if (!scritto) return;
    // un ingrediente già in lista e ancora da comprare non si aggiunge due volte
    const giaInLista = noto && lista.visibili.some((v) => v.ingrediente_id === noto.id && !v.spuntata);
    if (!giaInLista) aggiungi(scritto, noto?.id ?? null, noto ? null : repartoNuovaVoce);
    if (!noto && repartoNuovaVoce && repartoNuovaVoce !== ricordato && (repartoScelto || repartoNuovaVoce !== altro)) {
      ricorda(scritto, repartoNuovaVoce);
    }
    setTesto('');
    setRepartoScelto(null);
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
        {!spesa && !v.ingrediente_id && reparti.length > 0 && (
          <button
            className="togli cambia-reparto"
            aria-label={`Cambia reparto di ${nome(v)}`}
            aria-expanded={inSpostamento === v.id}
            onClick={() => setInSpostamento(inSpostamento === v.id ? null : v.id)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 6h9m0 0L9.5 3.5M12 6 9.5 8.5M15 12H6m0 0 2.5-2.5M6 12l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {!spesa && (
          <button className="togli" aria-label={`Elimina ${nome(v)}`} disabled={attesa} onClick={() => togli([v.id])}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {!spesa && inSpostamento === v.id && (
          <div className="scegli-reparto">
            <label htmlFor={`rep-${v.id}`}>Reparto di {nome(v)}</label>
            <select
              id={`rep-${v.id}`}
              value={v.reparto_id ?? altro ?? ''}
              onChange={(e) => {
                sposta(v.id, e.target.value);
                if (v.testo) ricorda(v.testo, e.target.value);
                setInSpostamento(null);
              }}
            >
              {reparti.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
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

          {gruppiReparto.map((r) => (
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
            {scritto && !noto && reparti.length > 0 && (
              <>
                <label htmlFor="reparto-voce">Reparto</label>
                <select id="reparto-voce" value={repartoNuovaVoce ?? ''} onChange={(e) => setRepartoScelto(e.target.value)}>
                  {reparti.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </>
            )}
          </form>
        </>
      )}
    </main>
  );
}
