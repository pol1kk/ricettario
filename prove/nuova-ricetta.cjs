// Prova di "Nuova ricetta": il testo incollato riempie il modulo, gli ingredienti vengono collegati al catalogo
// e convertiti nella loro unità, quelli non riconosciuti vanno scelti a mano, i valori si stimano dagli ingredienti.
const assert = require('assert');
const { crea } = require('./base.cjs');

const TESTO = `Riso e ceci veloce
Per 2 persone

Ingredienti
- 160 g di riso
- 1 barattolo di ceci cotti (240 g)
- 2 zucchine
- 1 cucchiaio di olio extravergine d'oliva
- 30 g di pecorino
- sale q.b.

Preparazione
1. Taglia le zucchine a rondelle.
2. Cuoci il riso e unisci i ceci.
`;

module.exports = async function nuovaRicetta() {
  const t = await crea();
  const { p, stato, chiamate } = t;
  try {
    await t.entra();
    await p.click('.barra-basso a:has-text("Ricette")');
    await p.click('text=Nuova ricetta');
    await p.waitForSelector('.nuova-ricetta');

    await p.fill('#nr-incolla', TESTO);
    await p.click('text=Riempi il modulo');
    assert.strictEqual(await p.inputValue('#nr-titolo'), 'Riso e ceci veloce');
    assert.strictEqual(await p.inputValue('#nr-porzioni'), '2');
    assert.strictEqual(await p.locator('.riga-ingrediente').count(), 6);
    const righe = await p.locator('.riga-ingrediente').evaluateAll((els) =>
      els.map((e) => [e.querySelector('.nome-ingrediente').textContent.trim(), e.querySelector('input').value, e.querySelector('.campo-unita span').textContent]),
    );
    assert.deepStrictEqual(righe, [
      ['Riso', '160', 'g'],
      ['Ceci cotti', '240', 'g'],
      ['Zucchine', '2', 'pezzi'],
      ["Olio extravergine d'oliva", '15', 'ml'],
      ['Scegli l’ingrediente', '30', ''],
      ['Sale', '', 'g'],
    ]);
    assert.strictEqual(await p.inputValue('#nr-passaggi'), 'Taglia le zucchine a rondelle.\nCuoci il riso e unisci i ceci.');
    assert.ok(await p.locator('form button[type=submit]').isDisabled(), 'non si salva finché un ingrediente non è scelto');
    await t.foto('nuova-ricetta');
    assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'niente scorrimento orizzontale');

    // l'ingrediente non riconosciuto si crea al momento
    await p.click('text=Scegli l’ingrediente');
    await p.fill('#cerca-ingrediente', 'pecorino');
    await p.click('text=Crea «pecorino» come nuovo ingrediente');
    await p.click('button:has-text("Crea l’ingrediente")');
    await p.waitForSelector('.riga-ingrediente');
    assert.strictEqual(await p.locator('.riga-ingrediente .nome-ingrediente').nth(4).innerText(), 'Pecorino');

    // un ingrediente aggiunto a mano e un tag
    await p.click('text=Aggiungi un ingrediente');
    await p.fill('#cerca-ingrediente', 'curcuma');
    await p.click('.scegli-ingrediente button:has-text("Curcuma")');
    await p.click('.scelta-tag .filtro:has-text("primo")');
    await p.fill('#nr-cottura', '20');
    await p.click('form button[type=submit]');

    // salvata: si apre la scheda, con i valori stimati dagli ingredienti
    await p.waitForFunction(() => location.hash.startsWith('#/ricetta/'));
    const salvata = chiamate.find((c) => c[0] === 'ricetta+');
    assert.deepStrictEqual(salvata.slice(1), ['Riso e ceci veloce', 2, "riso:160:g|ceci cotti:240:g|zucchine:2:unita|olio extravergine d'oliva:15:ml|pecorino:30:g|sale:null:g|curcuma:null:g", 2, 'primo']);
    const ricetta = stato.ricette[stato.ricette.length - 1];
    assert.deepStrictEqual([ricetta.kcal, ricetta.valori_fonte], [432, 'stimati']);
    await p.waitForSelector('h1:has-text("Riso e ceci veloce")');

    assert.deepStrictEqual(t.errori, [], 'nessun errore JavaScript');
  } finally {
    await t.chiudi();
  }
};
