// Base comune delle prove: apre l'app (già compilata e servita da `vite preview`) in un browser
// senza interfaccia, con una sessione finta e un finto Supabase che tiene lo stato in memoria.
// Dal contenitore cloud non si raggiungono né il database vero né il sito pubblicato: per questo
// le schermate si provano così. Le funzioni SQL si provano a parte (vedi docs/PROCEDURE.md).
//
// Uso:  const { crea } = require('./base.cjs');  const t = await crea();  ...  await t.chiudi();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const INDIRIZZO = process.env.PROVA_URL ?? 'http://127.0.0.1:4173/ricettario/';
const SCHERMATE = path.join(__dirname, 'schermate');
const CODICE_FINTO = '8001234567897'; // quello disegnato in prove/codice-8001234567897.mjpeg

const due = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
/** Data di oggi spostata di k giorni, "2026-11-16". */
const giorni = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return iso(d); };
/** "2026-11-16" -> "16112026", come la si scrive nel campo scadenza. */
const cifre = (s) => s.split('-').reverse().join('');

// ---------- dati finti ----------
// [id, nome, icona, tracciamento, reparto, ordine reparto, unità, kcal, proteine, carboidrati, grassi per 100, grammi per pezzo]
const CATALOGO = [
  ['i1', 'riso', '🍚', 'quantita', 'Pasta, riso e cereali', 50, 'g', 350, 7, 78, 0.6, null],
  ['i2', 'ceci cotti', '🫘', 'quantita', 'Legumi e conserve', 60, 'g', 120, 7, 17, 2, null],
  ['i3', 'zucchine', '🥒', 'quantita', 'Frutta e verdura', 10, 'unita', 17, 1.3, 2, 0.3, 200],
  ['i4', 'sale', '🧂', 'stato', 'Condimenti e spezie', 70, 'g', 0, 0, 0, 0, null],
  ['i5', "olio extravergine d'oliva", '🫒', 'stato', 'Condimenti e spezie', 70, 'ml', 824, 0, 0, 91.6, null],
  ['i6', 'uova', '🥚', 'quantita', 'Latticini e uova', 40, 'unita', 143, 12.6, 0.7, 9.9, 55],
  ['i7', 'fiocchi di latte magri', null, 'quantita', 'Latticini e uova', 40, 'g', 80, 12, 3, 2, null],
  ['i8', 'curcuma', null, 'stato', 'Condimenti e spezie', 70, 'g', 310, 8, 45, 10, null],
].map(([id, nome, icona, tracciamento, reparto, ordine, unita_base, kcal_100, proteine_100, carboidrati_100, grassi_100, grammi_per_unita]) => ({
  id, nome, icona, tracciamento, unita_base, kcal_100, proteine_100, carboidrati_100, grassi_100, grammi_per_unita,
  reparti: { nome: reparto, ordine },
}));

const TAG = [['vegetariana', 'Dieta'], ['proteica', 'Obiettivo'], ['colazione', 'Portata'], ['primo', 'Portata']]
  .map(([nome, gruppo], i) => ({ id: 't' + i, nome, gruppo, ordine: i, automatico: false }));

const REPARTI = [['r1', 'Frutta e verdura', 10], ['r2', 'Latticini e uova', 40], ['r3', 'Bevande', 110], ['r4', 'Altro', 999]]
  .map(([id, nome, ordine]) => ({ id, nome, ordine }));

const ID = { riso: '11111111-1111-1111-1111-111111111111', pancake: '22222222-2222-2222-2222-222222222222', tamago: '33333333-3333-3333-3333-333333333333' };

function ricetteFinte(catalogo) {
  const ing = (rid, iid, quantita, unita, posizione) => {
    const c = catalogo.find((x) => x.id === iid);
    return { id: rid + iid, ingrediente_id: iid, quantita, unita, testo_originale: null, gruppo: null, facoltativo: false, posizione,
      ingredienti: { nome: c.nome, icona: c.icona, tracciamento: c.tracciamento } };
  };
  const base = {
    autore: 'Prova', reel_url: 'https://www.instagram.com/p/x/', minuti_preparazione: 10, minuti_cottura: 20, minuti_totali: 30,
    note: null, da_verificare: false, note_verifica: null, copertina_path: null,
    passaggi: [
      { gruppo: 'Riso', testo: 'Taglia le zucchine a pezzetti e scola i ceci.' },
      { gruppo: 'Riso', testo: 'Metti tutti gli ingredienti crudi in un sacchetto e congelalo.' },
      { gruppo: 'Cottura', testo: "Versa il contenuto in una pentola, copri d'acqua e sala." },
      { gruppo: 'Cottura', testo: "Cuoci per 20 minuti e completa con un filo d'olio." },
    ],
  };
  return [
    { ...base, id: ID.riso, titolo: 'Riso con zucchine, ceci e curcuma (meal prep)', porzioni: 4, kcal: null, proteine_g: null, carboidrati_g: null, grassi_g: null, valori_fonte: null,
      ricetta_tag: [{ tag_id: 't0' }, { tag_id: 't3' }],
      ricetta_ingredienti: [ing('a', 'i1', 320, 'g', 1), ing('a', 'i2', 480, 'g', 2), ing('a', 'i3', 4, 'unita', 3), ing('a', 'i8', 12, 'g', 4), ing('a', 'i4', null, null, 5), ing('a', 'i5', null, null, 6)] },
    { ...base, id: ID.pancake, titolo: 'Pancake proteici con fiocchi di latte', porzioni: 10, kcal: 138, proteine_g: 10, carboidrati_g: 15.5, grassi_g: 4, valori_fonte: 'dichiarati',
      ricetta_tag: [{ tag_id: 't0' }, { tag_id: 't2' }],
      ricetta_ingredienti: [ing('b', 'i7', 450, 'g', 1), ing('b', 'i6', 4, 'unita', 2)] },
    { ...base, id: ID.tamago, titolo: 'Tamago sando fit', porzioni: 1, kcal: 310, proteine_g: 20.5, carboidrati_g: 30, grassi_g: 11.5, valori_fonte: 'dichiarati',
      ricetta_tag: [{ tag_id: 't1' }],
      ricetta_ingredienti: [ing('c', 'i6', 3, 'unita', 1), ing('c', 'i4', 1.5, 'g', 2)] },
  ];
}

/**
 * Apre il browser e prepara il finto backend.
 * opzioni.camera = true dà al browser una fotocamera finta che inquadra il codice a barre CODICE_FINTO.
 * Restituisce la pagina `p`, lo `stato` del finto database (modificabile prima di `entra()`),
 * l'elenco delle `chiamate` di scrittura ricevute e gli errori JavaScript `errori`.
 */
async function crea(opzioni = {}) {
  fs.mkdirSync(SCHERMATE, { recursive: true });
  const b = await chromium.launch({
    args: opzioni.camera
      ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${path.join(__dirname, 'codice-8001234567897.mjpeg')}`]
      : [],
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', permissions: opzioni.camera ? ['camera'] : [] });
  const p = await ctx.newPage();

  const catalogo = CATALOGO.map((x) => ({ ...x }));
  const stato = {
    catalogo, ricette: ricetteFinte(catalogo), piano: [], lista: [], diario: [], obiettivi: [], dispensa: [], prodotti: [], ricordate: [],
    /** risposte di Open Food Facts per codice a barre */
    openFoodFacts: {},
    /** false = come senza connessione: ogni richiesta fallisce */
    rete: true,
  };
  const chiamate = [];
  const errori = [];
  let n = 0;
  const nuovoId = (prefisso) => prefisso + ++n;

  p.on('pageerror', (e) => errori.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errori.push(m.text()));

  const j = (corpo, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
  const vuota = (status = 204) => ({ status, body: '' });
  const idDi = (url) => (decodeURIComponent(url).match(/id=eq\.([^&]+)/) || [])[1];
  const rotta = (schema, f) => p.route(schema, (r) => (stato.rete ? f(r, r.request()) : r.abort('internetdisconnected')));
  const corpo = (q) => JSON.parse(q.postData());

  await rotta('**/auth/v1/**', (r) => r.fulfill(j({})));
  await rotta('**/rest/v1/case**', (r) => r.fulfill(j([{ id: 'c1', nome: 'Casa', soglia_veloce_minuti: 20, porzioni_predefinite: 2 }])));
  await rotta('**/rest/v1/tag**', (r) => r.fulfill(j(TAG)));
  await rotta('**/rest/v1/ricette**', (r) => r.fulfill(j(stato.ricette)));
  await rotta('**/rest/v1/reparti**', (r) => r.fulfill(j(REPARTI)));

  await rotta('**/rest/v1/ingredienti**', (r, q) => {
    if (q.method() === 'GET') return r.fulfill(j(stato.catalogo));
    const v = corpo(q);
    const id = nuovoId('nuovo-i');
    chiamate.push(['ingrediente+', v.nome, v.unita_base, v.kcal_100 ?? null]);
    stato.catalogo.push({ id, nome: v.nome, icona: null, tracciamento: 'quantita', unita_base: v.unita_base, kcal_100: v.kcal_100 ?? null, proteine_100: v.proteine_100 ?? null,
      carboidrati_100: v.carboidrati_100 ?? null, grassi_100: v.grassi_100 ?? null, grammi_per_unita: null, reparti: { nome: 'Altro', ordine: 999 } });
    return r.fulfill(j({ id }, 201));
  });

  await rotta('**/rest/v1/voci_ricordate**', (r, q) => {
    if (q.method() === 'GET') return r.fulfill(j(stato.ricordate));
    const v = corpo(q);
    stato.ricordate.push({ testo: v.testo, reparto_id: v.reparto_id });
    return r.fulfill(vuota(201));
  });

  await rotta('**/rest/v1/piano_pasti**', (r, q) => {
    const m = q.method();
    if (m === 'GET') return r.fulfill(j(stato.piano));
    if (m === 'POST') { const v = corpo(q); chiamate.push(['piano+', v.data, v.pasto, v.porzioni, !!v.cucinata_il]); stato.piano.push({ id: nuovoId('p'), ...v }); return r.fulfill(vuota(201)); }
    if (m === 'PATCH') { Object.assign(stato.piano.find((x) => x.id === idDi(q.url())), corpo(q)); return r.fulfill(vuota()); }
    stato.piano = stato.piano.filter((x) => x.id !== idDi(q.url()));
    return r.fulfill(vuota());
  });

  await rotta('**/rest/v1/lista_spesa**', (r, q) => {
    const m = q.method();
    const url = decodeURIComponent(q.url());
    if (m === 'GET') return r.fulfill(j(stato.lista));
    if (m === 'POST') { const v = corpo(q); if (!stato.lista.some((x) => x.id === v.id)) stato.lista.push({ quantita: null, unita: null, ...v }); return r.fulfill(vuota(201)); }
    if (m === 'PATCH') { const v = stato.lista.find((x) => x.id === idDi(url)); if (v) Object.assign(v, corpo(q)); return r.fulfill(vuota()); }
    const ids = (url.match(/id=in\.\(([^)]*)\)/) || [, ''])[1].split(',').map((s) => s.replace(/"/g, ''));
    stato.lista = stato.lista.filter((x) => !ids.includes(x.id));
    return r.fulfill(vuota());
  });

  await rotta('**/rest/v1/rpc/genera_lista_spesa', (r) => {
    const totali = new Map();
    for (const v of stato.piano) {
      if (!v.ricetta_id || v.cucinata_il) continue;
      const ricetta = stato.ricette.find((x) => x.id === v.ricetta_id);
      for (const i of ricetta.ricetta_ingredienti) {
        if (i.quantita === null || i.ingredienti.tracciamento !== 'quantita') continue;
        totali.set(i.ingrediente_id, [(totali.get(i.ingrediente_id)?.[0] ?? 0) + (i.quantita * (v.porzioni ?? ricetta.porzioni)) / ricetta.porzioni, i.unita]);
      }
    }
    stato.lista = stato.lista.filter((x) => x.origine !== 'menu');
    for (const [ingrediente_id, [quantita, unita]] of totali) stato.lista.push({ id: nuovoId('l'), ingrediente_id, testo: null, quantita, unita, spuntata: false, origine: 'menu' });
    return r.fulfill(j(totali.size));
  });

  await rotta('**/rest/v1/diario**', (r, q) => {
    const m = q.method();
    if (m === 'GET') return r.fulfill(j(/creato_il\.desc/.test(decodeURIComponent(q.url())) ? [...stato.diario].reverse() : stato.diario));
    if (m === 'POST') { const v = corpo(q); chiamate.push(['diario+', v.pasto, v.nome, v.quantita, v.unita, v.kcal]); stato.diario.push({ id: nuovoId('d'), ...v }); return r.fulfill(vuota(201)); }
    if (m === 'PATCH') { Object.assign(stato.diario.find((x) => x.id === idDi(q.url())), corpo(q)); return r.fulfill(vuota()); }
    stato.diario = stato.diario.filter((x) => x.id !== idDi(q.url()));
    return r.fulfill(vuota());
  });

  await rotta('**/rest/v1/obiettivi**', (r, q) => {
    if (q.method() === 'GET') return r.fulfill(j(stato.obiettivi));
    const v = corpo(q);
    stato.obiettivi = [{ fissi: v.fissi, settimana: v.settimana, giorni: v.giorni }];
    chiamate.push(['obiettivi', v.fissi, JSON.stringify(v.settimana)]);
    return r.fulfill(vuota(201));
  });

  await rotta('**/rest/v1/dispensa**', (r, q) => {
    if (q.method() === 'GET') {
      return r.fulfill(j(stato.dispensa.filter((x) => !x.esaurita_il).map((x) => ({ ...x, prodotti: stato.prodotti.find((y) => y.id === x.prodotto_id) ?? null }))));
    }
    const campi = corpo(q);
    chiamate.push(['dispensa~', JSON.stringify(campi)]);
    Object.assign(stato.dispensa.find((x) => x.id === idDi(q.url())), campi);
    return r.fulfill(vuota());
  });

  await rotta('**/rest/v1/prodotti**', (r, q) => {
    if (q.method() === 'GET') {
      const codice = (decodeURIComponent(q.url()).match(/codice_barre=eq\.(\d+)/) || [])[1];
      return r.fulfill(j(stato.prodotti.filter((x) => x.codice_barre === codice)));
    }
    const v = corpo(q);
    const nuovo = { id: nuovoId('pr'), ...v };
    stato.prodotti.push(nuovo);
    chiamate.push(['prodotto+', v.codice_barre, v.nome, v.ingrediente_id, v.formato_quantita, v.formato_unita]);
    return r.fulfill(j(nuovo, 201));
  });

  await rotta('**/rest/v1/rpc/metti_in_dispensa', (r, q) => {
    const c = corpo(q).p;
    chiamate.push(['metti', JSON.stringify(c)]);
    const aStato = stato.catalogo.find((x) => x.id === c.ingrediente_id).tracciamento === 'stato';
    for (let k = 0; k < (c.confezioni ?? 1); k++) {
      stato.dispensa.push({ id: nuovoId('x'), ingrediente_id: c.ingrediente_id, prodotto_id: c.prodotto_id ?? null, quantita: aStato ? null : c.quantita,
        stato: aStato ? 'presente' : null, scadenza: c.scadenza ?? null, posizione: c.posizione });
    }
    if (c.voce_lista) stato.lista = stato.lista.filter((x) => x.id !== c.voce_lista);
    return r.fulfill(j(c.confezioni ?? 1));
  });

  await rotta('**/rest/v1/rpc/chiudi_confezione', (r, q) => {
    const c = corpo(q);
    chiamate.push(['chiudi', c.p_motivo]);
    stato.dispensa.find((x) => x.id === c.p_dispensa).esaurita_il = 'ora';
    return r.fulfill(vuota());
  });

  await rotta('**/world.openfoodfacts.org/**', (r, q) => {
    const trovato = stato.openFoodFacts[q.url().match(/product\/(\d+)/)[1]];
    return r.fulfill(trovato ? j({ status: 1, product: trovato }) : j({ status: 0 }, 404));
  });

  /** Apre l'app già autenticata e aspetta la schermata iniziale (il Diario). */
  async function entra() {
    await p.goto(INDIRIZZO);
    await p.evaluate(() => {
      localStorage.setItem('ricettario.password-impostata', '1');
      localStorage.setItem('sb-kifgpxyikxpsdqhlookw-auth-token', JSON.stringify({
        access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'u1', email: 'prova@example.com', aud: 'authenticated', role: 'authenticated' },
      }));
    });
    await p.reload();
    await p.waitForSelector('.diario');
    p.setDefaultTimeout(10000);
  }

  /** Salva una schermata in prove/schermate/<nome>.png dopo aver lasciato finire le animazioni. */
  async function foto(nome, intera = true) {
    await p.waitForTimeout(450);
    await p.screenshot({ path: path.join(SCHERMATE, nome + '.png'), fullPage: intera });
  }

  return { p, stato, chiamate, errori, entra, foto, chiudi: () => b.close() };
}

module.exports = { crea, giorni, cifre, ID, CODICE_FINTO, SCHERMATE };
