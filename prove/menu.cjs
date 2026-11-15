// Prova del menù condiviso con voci personali: cosa vede ognuno, l'interruttore per vedere tutta la casa,
// "Per me qualcos'altro", e nel diario la porzione consigliata per i propri obiettivi.
const assert = require('assert');
const { crea, giorni, ID } = require('./base.cjs');

module.exports = async function menu() {
  const t = await crea();
  const { p, stato } = t;
  try {
    const oggi = giorni(0);
    stato.piano.push(
      { id: 'p1', data: oggi, pasto: 'pranzo', ricetta_id: ID.tamago, nota: null, porzioni: 2, cucinata_il: null, per_utente: null },
      { id: 'p2', data: oggi, pasto: 'merenda_mattino', ricetta_id: null, nota: 'Yogurt di Diana', porzioni: null, cucinata_il: null, per_utente: 'u2' },
    );
    stato.obiettivi = [{ fissi: true, settimana: { kcal: 2000, proteine_g: 140 }, giorni: {} }];
    await t.entra();

    // diario: la voce comune con la porzione adatta ai propri obiettivi; la voce personale di un altro non compare
    await p.waitForSelector('.diario .proposta');
    assert.strictEqual(await p.locator('.proposta').count(), 1);
    assert.match(await p.locator('.proposta').innerText(), /Tamago[\s\S]*per te 2 porzioni[\s\S]*620 kcal/);

    // menù: di base non si vedono le voci personali degli altri
    await p.click('.barra-basso a:has-text("Menù")');
    await p.waitForSelector('.giorno.oggi');
    const oggiMenu = p.locator('.giorno.oggi');
    assert.strictEqual(await oggiMenu.locator('.riga-voce').count(), 1);
    await p.check('.tutta-casa input');
    assert.match(await oggiMenu.locator('.riga-voce:has-text("Yogurt")').innerText(), /solo per Diana/);
    await p.uncheck('.tutta-casa input');

    // una merenda parte come "solo per me", con una porzione
    await oggiMenu.locator('[aria-label$="merenda del pomeriggio"]').click();
    await p.waitForSelector('.scegli-pasto');
    assert.strictEqual(await p.locator('.per-chi [aria-pressed=true]').innerText(), 'Solo per me');
    await p.click('.ricette button:has-text("Pancake")');
    await p.waitForSelector('.giorno.oggi .riga-voce:has-text("Pancake")');
    const merenda = stato.piano.find((x) => x.ricetta_id === ID.pancake);
    assert.deepStrictEqual([merenda.per_utente, merenda.porzioni], ['u1', 1]);
    assert.match(await oggiMenu.locator('.riga-voce:has-text("Pancake")').innerText(), /solo per te/);

    // "Per me qualcos'altro" sul pranzo comune: voce personale e proposta di togliere una porzione da quella comune
    await oggiMenu.locator('.riga-voce:has-text("Tamago")').click();
    await p.click('text=Per me qualcos’altro');
    await p.waitForSelector('.scegli-pasto');
    assert.strictEqual(await p.locator('.per-chi [aria-pressed=true]').innerText(), 'Solo per me');
    await p.click('.ricette button:has-text("Riso con zucchine")');
    await p.waitForSelector('.avviso-riduci');
    await t.foto('menu-voci-personali');
    await p.click('text=Togli una porzione');
    await p.waitForFunction(() => !document.querySelector('.avviso-riduci'));
    assert.strictEqual(stato.piano.find((x) => x.id === 'p1').porzioni, 1);
    assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'niente scorrimento orizzontale');

    // nel diario il pranzo proposto ora è quello personale, non più quello comune
    await p.click('.barra-basso a:has-text("Diario")');
    await p.waitForSelector('.diario .proposta');
    const pranzo = p.locator('.pasto-diario:has(h2:text-is("Pranzo")) .proposta');
    assert.strictEqual(await pranzo.count(), 1);
    assert.match(await pranzo.innerText(), /Riso con zucchine[\s\S]*solo per te/);
    await t.foto('diario-voci-personali');

    // il proprio nome si cambia dalle impostazioni
    await p.click('.barra-basso a:has-text("Ricette")');
    await p.click('text=Impostazioni');
    await p.waitForSelector('#mio-nome');
    await p.waitForFunction(() => document.querySelector('#mio-nome').value === 'Paul');
    await p.fill('#mio-nome', 'Paolo');
    await p.click('.il-mio-nome button');
    await p.waitForFunction(() => /Salvato/.test(document.querySelector('.il-mio-nome button')?.textContent ?? ''));
    assert.strictEqual(stato.membri[0].nome, 'Paolo');

    assert.deepStrictEqual(t.errori, [], 'nessun errore JavaScript');
  } finally {
    await t.chiudi();
  }
};
