// Prova della dispensa: scorte e scadenze, modifica e chiusura di una confezione, scansione dalla
// fotocamera (finta) di un prodotto nuovo, riconoscimento alla seconda scansione, fine spesa.
const assert = require('assert');
const { crea, giorni, cifre, CODICE_FINTO } = require('./base.cjs');

module.exports = async function dispensa() {
  const t = await crea({ camera: true });
  const { p, stato, chiamate } = t;
  try {
    stato.openFoodFacts[CODICE_FINTO] = { product_name_it: 'Latte intero UHT', brands: 'Fattoria Prova, Altro', quantity: '1 l',
      nutriments: { 'energy-kcal_100g': 64, proteins_100g: 3.3, carbohydrates_100g: 4.8, fat_100g: 3.6 } };
    stato.openFoodFacts['8009876543210'] = { product_name: 'Riso Carnaroli', brands: 'Risaia', product_quantity: '1000', product_quantity_unit: 'g', nutriments: {} };
    stato.dispensa.push(
      { id: 'x1', ingrediente_id: 'i6', prodotto_id: null, quantita: 6, stato: null, scadenza: giorni(2), posizione: 'frigo' },
      { id: 'x2', ingrediente_id: 'i6', prodotto_id: null, quantita: 4, stato: null, scadenza: giorni(12), posizione: 'frigo' },
      { id: 'x3', ingrediente_id: 'i2', prodotto_id: null, quantita: 240, stato: null, scadenza: giorni(-1), posizione: 'dispensa' },
      { id: 'x4', ingrediente_id: 'i5', prodotto_id: null, quantita: null, stato: 'sta_finendo', scadenza: null, posizione: 'dispensa' },
      { id: 'x5', ingrediente_id: 'i3', prodotto_id: null, quantita: 3, stato: null, scadenza: null, posizione: 'frigo' },
    );
    stato.lista.push(
      { id: 'l1', ingrediente_id: 'i1', testo: null, reparto_id: null, quantita: 320, unita: 'g', spuntata: true, origine: 'menu' },
      { id: 'l2', ingrediente_id: 'i4', testo: null, reparto_id: null, quantita: null, unita: null, spuntata: true, origine: 'manuale' },
      { id: 'l3', ingrediente_id: null, testo: 'Carta forno', reparto_id: 'r4', quantita: null, unita: null, spuntata: true, origine: 'manuale' },
      { id: 'l4', ingrediente_id: 'i7', testo: null, reparto_id: null, quantita: 450, unita: 'g', spuntata: false, origine: 'menu' },
    );
    await t.entra();
    await p.click('.barra-basso a:has-text("Dispensa")');
    await p.waitForSelector('.scorte');

    // una riga per ingrediente, dalla scadenza più vicina
    const righe = (await p.locator('.scorta').allInnerTexts()).map((x) => x.replace(/\n+/g, ' | '));
    assert.deepStrictEqual(righe, [
      '🫘 | Ceci cotti | scaduto ieri | 240 g',
      '🥚 | Uova | scade tra 2 giorni, 2 confezioni | 10',
      "🫒 | Olio extravergine d'oliva | senza scadenza | sta finendo",
      '🥒 | Zucchine | senza scadenza | 3',
    ]);
    assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'niente scorrimento orizzontale');

    // modifica e chiusura di una confezione
    await p.click('.scorta:has-text("Uova")');
    await p.click('.riga-confezione >> nth=0');
    await p.fill('.modifica-confezione input >> nth=0', '5');
    await p.fill('.modifica-confezione input >> nth=1', '2512');
    assert.strictEqual(await p.inputValue('.modifica-confezione input >> nth=1'), '25/12', 'le barre della data si mettono da sole');
    await t.foto('dispensa-confezione', false);
    await p.click('.modifica-confezione button[type=submit]');
    await p.waitForFunction(() => !document.querySelector('.modifica-confezione'));
    assert.strictEqual(stato.dispensa.find((x) => x.id === 'x1').quantita, 5);
    await p.click('.riga-confezione >> nth=1');
    await p.click('text=È finita');
    await p.waitForFunction(() => document.querySelectorAll('.riga-confezione').length === 1);
    // "Ne ho usato": scala dalla confezione rimasta
    await p.fill('.uso-rapido input', '2');
    await p.click('.uso-rapido button');
    await p.waitForFunction(() => /^2$/.test(document.querySelector('.scorta[aria-expanded=true] .quanto')?.textContent ?? ''));
    assert.ok(chiamate.some((c) => c[0] === 'scala' && c[1] === 'uso'), 'scarico senza ricetta');
    // le uova scadono a Natale: nessun suggerimento; i ceci scaduti propongono la ricetta che li usa
    await p.click('.scorta:has-text("Ceci cotti")');
    assert.match(await p.locator('.da-usare').innerText(), /Ricette per usarlo[\s\S]*Riso con zucchine/);
    await t.foto('dispensa-da-usare', false);
    await p.click('.scorta:has-text("Uova")');
    await p.click('text=Metti nella lista della spesa');
    await p.waitForSelector('.confezioni .nota');
    await p.click('.filtro:has-text("Frigo")');
    assert.deepStrictEqual(await p.locator('.scorta .titolo').allInnerTexts(), ['Uova', 'Zucchine']);
    await p.click('.filtro:has-text("Tutto")');

    // prodotto mai visto, letto dalla fotocamera: chiede l'ingrediente una volta sola
    await p.click('.azioni-dispensa button:has-text("Scansiona")');
    await p.waitForSelector('.aggiungi-dispensa .scegli-ingrediente', { timeout: 20000 });
    assert.strictEqual(await p.locator('.aggiungi-dispensa h1').innerText(), 'Latte intero UHT');
    await p.click('text=Crea un nuovo ingrediente');
    assert.strictEqual(await p.inputValue('#ni-unita'), 'ml', "l'unità viene dal formato del prodotto");
    await p.fill('#ni-nome', 'latte intero');
    await p.click('button:has-text("Crea l’ingrediente")');
    await p.waitForSelector('.confezione');
    assert.strictEqual(await p.inputValue('#conf-quantita'), '1000', 'quantità dal formato della confezione');
    await p.fill('#conf-scadenza', cifre(giorni(5)));
    await p.click('[aria-label="Una confezione in più"]');
    await t.foto('dispensa-metti-via');
    await p.click('button:has-text("Metti in dispensa")');
    await p.waitForSelector('.scorta:has-text("Latte intero")');
    assert.match(await p.locator('.scorta:has-text("Latte intero")').innerText(), /2 confezioni[\s\S]*2 l/);

    // lo stesso codice la seconda volta viene riconosciuto senza domande
    await p.click('.azioni-dispensa button:has-text("Scansiona")');
    await p.waitForSelector('.confezione', { timeout: 20000 });
    assert.strictEqual(await p.locator('.confezione h1').innerText(), 'Latte intero');
    await p.click('.confezione .indietro');
    await p.click('.aggiungi-dispensa .indietro');
    await p.waitForSelector('.scorte');

    // fine spesa: le voci nel carrello una alla volta
    await p.click('.schede-dispensa button:has-text("Da comprare")');
    await p.waitForSelector('.lista .carrello');
    await t.foto('lista-con-carrello');
    await p.click('text=Fine spesa: metti in dispensa');
    await p.waitForSelector('.confezione');
    assert.strictEqual(await p.locator('.passo-spesa').innerText(), 'Metti via la spesa, 1 di 2');
    assert.strictEqual(await p.inputValue('#conf-quantita'), '320', 'senza scansione propone la quantità della lista');

    // la fotocamera finta inquadra il latte: codice di un altro ingrediente, non va usato per il riso
    await p.click('text=Scansiona la confezione');
    await p.waitForSelector('.confezione .stato-rete', { timeout: 20000 });
    assert.strictEqual(await p.inputValue('#conf-quantita'), '320');

    // fotocamera negata: resta il codice scritto a mano; prodotto nuovo collegato alla voce senza domande
    await p.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); });
    await p.click('text=Scansiona la confezione');
    await p.waitForSelector('.scanner .errore');
    await p.fill('#codice', '8009876543210');
    await p.click('.codice-a-mano button');
    await p.waitForSelector('.confezione .origine');
    assert.strictEqual(await p.inputValue('#conf-quantita'), '1000');
    await p.fill('#conf-scadenza', '31122027');
    await p.click('button:has-text("Metti in dispensa")');
    await p.waitForFunction(() => /2 di 2/.test(document.querySelector('.passo-spesa')?.textContent ?? ''));
    assert.strictEqual(await p.locator('#conf-quantita').count(), 0, 'gli ingredienti di base non hanno quantità');
    await p.click('text=Salta, non va in dispensa');
    await p.waitForSelector('.fine-spesa');
    await p.click('text=Vai alla dispensa');
    await p.waitForSelector('.scorte');
    assert.match((await p.locator('.scorta:has-text("Riso")').innerText()).replace(/\n+/g, ' '), /31\/12\/2027 1 kg/);
    assert.ok(!stato.lista.some((x) => ['l1', 'l2', 'l3'].includes(x.id)), 'il carrello è stato svuotato');
    assert.ok(stato.lista.some((x) => x.id === 'l4'), 'le voci non comprate restano');
    await t.foto('dispensa');

    // la sezione riapre l'ultima scheda usata
    await p.click('.schede-dispensa button:has-text("Da comprare")');
    await p.waitForSelector('.lista');
    await p.click('.barra-basso a:has-text("Menù")');
    await p.click('.barra-basso a:has-text("Dispensa")');
    await p.waitForSelector('.lista');

    assert.strictEqual(chiamate.filter((c) => c[0] === 'metti').length, 2);
    assert.deepStrictEqual(t.errori, [], 'nessun errore JavaScript');
  } finally {
    await t.chiudi();
  }
};
