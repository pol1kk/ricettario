// Prova di "Cosa mangio?": l'ordine dei consigli e i motivi in base a dispensa, scadenze, pasto e
// richieste; aggiunta al diario; ingredienti mancanti in lista; scarico dalla dispensa dopo aver cucinato.
const assert = require('assert');
const { crea, giorni, ID } = require('./base.cjs');

module.exports = async function consiglio() {
  const t = await crea();
  const { p, stato, chiamate } = t;
  try {
    stato.dispensa.push(
      { id: 'x1', ingrediente_id: 'i6', prodotto_id: null, quantita: 6, stato: null, scadenza: giorni(1), posizione: 'frigo' },
      { id: 'x2', ingrediente_id: 'i7', prodotto_id: null, quantita: 500, stato: null, scadenza: giorni(20), posizione: 'frigo' },
      { id: 'x3', ingrediente_id: 'i1', prodotto_id: null, quantita: 100, stato: null, scadenza: null, posizione: 'dispensa' },
    );
    stato.obiettivi = [{ fissi: true, settimana: { kcal: 2000, proteine_g: 140 }, giorni: {} }];
    await t.entra();
    await p.click('text=Consigliami un pasto');
    await p.waitForSelector('.proposte');
    const titoli = () => p.locator('.proposta-pasto .titolo').allInnerTexts();
    const motivi = (n) => p.locator('.proposta-pasto').nth(n).locator('.motivi li').allInnerTexts();

    // a pranzo, per una persona: prima la ricetta che si può fare tutta e usa le uova che scadono
    await p.selectOption('#c-pasto', 'pranzo');
    await p.selectOption('#c-persone', '1');
    assert.strictEqual((await titoli())[0], 'Tamago sando fit');
    const primi = await motivi(0);
    assert.strictEqual(primi[0], 'Hai tutto in casa');
    assert.ok(primi.includes('Usa uova: scade domani'), primi.join(' | '));
    assert.ok(primi.some((m) => /porzion.*kcal.*ti resta/.test(m)), 'spiega le porzioni rispetto agli obiettivi');
    assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'niente scorrimento orizzontale');
    await t.foto('consiglio');

    // a colazione passa avanti la ricetta da colazione
    await p.selectOption('#c-pasto', 'colazione');
    assert.strictEqual((await titoli())[0], 'Pancake proteici con fiocchi di latte');
    await p.selectOption('#c-pasto', 'pranzo');

    // richiesta libera: resta solo il riso, con scritto cosa manca; quello che manca va in lista
    await p.fill('#c-testo', 'qualcosa con il riso');
    assert.deepStrictEqual(await titoli(), ['Riso con zucchine, ceci e curcuma (meal prep)']);
    assert.strictEqual((await motivi(0))[0], 'Mancano: ceci cotti, zucchine');
    await p.click('text=Metti in lista quello che manca');
    await p.waitForSelector('.fatto-nota');
    await p.waitForFunction(() => true);
    await p.waitForTimeout(400);
    assert.deepStrictEqual(stato.lista.map((x) => x.ingrediente_id).sort(), ['i2', 'i3']);

    // un filtro che esclude tutto lo dice chiaramente
    await p.click('.filtro:has-text("15 min")');
    await p.waitForSelector('.consiglio .vuoto');
    await p.click('.filtro:has-text("Qualsiasi tempo")');
    await p.fill('#c-testo', '');

    // aggiungere al diario il consiglio
    await p.locator('.proposta-pasto').first().locator('text=Aggiungi al diario').click();
    await p.waitForSelector('.fatto-nota');
    assert.strictEqual(stato.diario.length, 1);
    assert.strictEqual(stato.diario[0].pasto, 'pranzo');
    assert.strictEqual(stato.diario[0].ricetta_id, ID.tamago);

    // cucinarla: alla fine propone di togliere dalla dispensa le uova usate
    await p.locator('.proposta-pasto').first().locator('button:text-is("Cucina")').click();
    await p.waitForSelector('.cucina');
    await p.click('button:has-text("Inizia a cucinare")');
    for (let k = 0; k < 3; k++) await p.click('.comandi-cucina button:has-text("Avanti")');
    await p.click('button:has-text("Ho finito")');
    await p.waitForSelector('.scarico');
    assert.match(await p.locator('.scarico li').first().innerText(), /Uova[\s\S]*ne hai 6/);
    await t.foto('scarico');
    await p.click('.scarico button:has-text("Togli dalla dispensa")');
    await p.waitForFunction(() => /Dispensa aggiornata/.test(document.querySelector('.scarico')?.textContent ?? ''));
    const scala = chiamate.find((c) => c[0] === 'scala');
    assert.ok(scala && scala[1] === 'ricetta');
    assert.ok(stato.dispensa.find((x) => x.id === 'x1').quantita < 6, 'le uova sono state scalate');

    assert.deepStrictEqual(t.errori, [], 'nessun errore JavaScript');
  } finally {
    await t.chiudi();
  }
};
