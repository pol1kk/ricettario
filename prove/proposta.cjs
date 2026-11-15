// Prova di "Proponi settimana": questionario al primo utilizzo, pasti comuni per tutta la casa, colazioni e
// merende personali (anche alimenti in coppia), limiti sugli ingredienti, porzioni sensate, "Un'altra",
// "Annulla la proposta" e "Tieni tutto", e la conferma nel diario di una merenda fatta di alimenti.
const assert = require('assert');
const { crea, ID } = require('./base.cjs');

module.exports = async function proposta() {
  const t = await crea();
  const { p, stato } = t;
  try {
    stato.obiettivi = [{ fissi: true, settimana: { kcal: 2000, proteine_g: 140 }, giorni: {} }];
    stato.obiettiviAltri = [{ utente_id: 'u2', fissi: true, settimana: { kcal: 1500, proteine_g: 90 }, giorni: {} }];
    await t.entra();
    await p.click('.barra-basso a:has-text("Menù")');
    await p.waitForSelector('.menu .giorno');
    await p.click('[aria-label="Settimana successiva"]');
    await p.waitForTimeout(300);

    // primo utilizzo: si passa dal questionario, una domanda alla volta
    await p.click('text=Proponi settimana');
    await p.waitForSelector('.preferenze .domanda');
    assert.match(await p.locator('.preferenze .origine').innerText(), /Domanda 1 di 8/);
    assert.strictEqual(await p.locator('.domanda').count(), 1);
    for (let k = 0; k < 4; k++) await p.click('.passi button:text-is("Avanti")');
    // domanda 5: un limite sui legumi, al massimo una volta a settimana
    await p.click('text=Aggiungi un limite');
    await p.selectOption('.limite select >> nth=0', 'gruppo:legumi');
    await p.selectOption('.limite select >> nth=1', '1');
    await t.foto('preferenze-limiti', false);
    await p.click('.passi button:text-is("Avanti")');
    // domanda 6: la stessa ricetta si può ripetere (le ricette finte sono poche)
    await p.click('.filtro:has-text("Non importa")');
    await p.click('.passi button:text-is("Avanti")');
    await p.click('.passi button:text-is("Avanti")');
    await p.click('text=Salva e proponi la settimana');

    // la proposta parte da sola al ritorno nel menù
    await p.waitForSelector('.menu .avviso-riduci');
    assert.ok(stato.preferenzeCasa.compilate, 'le preferenze risultano compilate');
    assert.deepStrictEqual(stato.preferenzePersone.u1.limiti, [{ tipo: 'gruppo', id: 'legumi', max: 1 }]);
    const comuni = stato.piano.filter((v) => !v.per_utente);
    assert.strictEqual(comuni.length, 14, 'pranzo e cena per sette giorni');
    assert.ok(stato.piano.every((v) => v.proposta), 'tutte segnate come proposte');
    assert.strictEqual(comuni.filter((v) => v.ricetta_id === ID.riso).length, 1, 'i legumi una volta sola: il limite di una persona vale per il pasto comune');
    assert.ok(comuni.every((v) => v.ricetta_id !== ID.pancake), 'una ricetta da colazione non diventa un pranzo');

    // porzioni sensate: mai più di due a testa, alimenti vicini alla porzione tipica
    assert.ok(comuni.every((v) => v.porzioni >= 1 && v.porzioni <= 4), 'due persone, al massimo due porzioni a testa');
    const personali = stato.piano.filter((v) => v.per_utente);
    assert.ok(personali.some((v) => v.per_utente === 'u1') && personali.some((v) => v.per_utente === 'u2'), 'colazioni e merende per entrambe le persone');
    const limitiPorzione = { i6: [1, 3], i7: [75, 225], i9: [2, 5], i10: [15, 40] };
    const conAlimenti = personali.filter((v) => v.alimenti);
    assert.ok(conAlimenti.length > 0, 'ci sono merende fatte di alimenti singoli');
    for (const v of conAlimenti) for (const a of v.alimenti) assert.ok(a.quantita >= limitiPorzione[a.ingrediente_id][0] && a.quantita <= limitiPorzione[a.ingrediente_id][1], `${v.nota}: ${a.quantita}`);
    assert.ok(personali.filter((v) => v.ricetta_id).every((v) => v.porzioni >= 0.5 && v.porzioni <= 2));
    await t.foto('menu-proposta');
    assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'niente scorrimento orizzontale');

    // "Un'altra" su una merenda personale la sostituisce
    const merenda = stato.piano.find((v) => v.per_utente === 'u1' && v.pasto === 'merenda_mattino');
    const prima = merenda.ricetta_id ?? merenda.nota;
    await p.locator('.giorno').first().locator('.riga-voce').nth(1).click();
    await p.click('.pannello-voce button:has-text("Un’altra")');
    await p.waitForFunction(() => !document.querySelector('.menu button[disabled]'));
    await p.waitForTimeout(300);
    assert.notStrictEqual(merenda.ricetta_id ?? merenda.nota, prima, 'la merenda è cambiata');

    // annullare toglie tutto quello che è stato proposto
    await p.click('text=Annulla la proposta');
    await p.waitForFunction(() => !document.querySelector('.menu .avviso-riduci'));
    assert.strictEqual(stato.piano.length, 0);

    // dalla seconda volta la proposta parte subito; "Tieni tutto" la rende definitiva
    await p.click('text=Proponi settimana');
    await p.waitForSelector('.menu .avviso-riduci');
    assert.ok(stato.piano.length >= 14);
    await p.click('text=Tieni tutto');
    await p.waitForFunction(() => !document.querySelector('.menu .avviso-riduci'));
    assert.ok(stato.piano.length >= 14 && stato.piano.every((v) => !v.proposta));

    // le preferenze, una volta compilate, sono tutte in una pagina
    await p.click('.azioni-menu >> text=Preferenze');
    await p.waitForSelector('.preferenze .domanda');
    assert.strictEqual(await p.locator('.domanda').count(), 8);
    await t.foto('preferenze');
    await p.click('.preferenze .indietro');

    // questa settimana, da oggi: nel diario una merenda fatta di alimenti si conferma con un tocco
    await p.waitForSelector('.menu .giorno');
    await p.click('text=Questa settimana');
    await p.waitForTimeout(300);
    await p.click('text=Proponi settimana');
    await p.waitForSelector('.menu .avviso-riduci');
    await p.click('.barra-basso a:has-text("Diario")');
    await p.waitForSelector('.diario .proposta');
    const diOggi = p.locator('.pasto-diario:has(h2:text-is("Merenda del pomeriggio")) .proposta');
    assert.strictEqual(await diOggi.count(), 1);
    assert.match(await diOggi.innerText(), /solo per te[\s\S]*kcal/);
    await t.foto('diario-proposta');
    await diOggi.locator('button').click();
    await p.waitForSelector('.pasto-diario:has(h2:text-is("Merenda del pomeriggio")) .riga-voce');
    assert.ok(stato.diario.length >= 1 && stato.diario.every((v) => v.ingrediente_id && v.kcal > 0), 'una voce di diario per ogni alimento');

    assert.deepStrictEqual(t.errori, [], 'nessun errore JavaScript');
  } finally {
    await t.chiudi();
  }
};
