// Prova del diario: proposte dal menù, aggiunta di ricette, alimenti e voci a mano, obiettivi,
// modifica, vista settimanale, barra in basso.
const assert = require('assert');
const { crea, giorni, ID } = require('./base.cjs');

module.exports = async function diario() {
  const t = await crea();
  const { p, stato, chiamate } = t;
  try {
    const oggi = giorni(0);
    stato.piano.push(
      { id: 'p901', data: oggi, pasto: 'pranzo', ricetta_id: ID.tamago, nota: null, porzioni: 2, cucinata_il: null },
      { id: 'p902', data: oggi, pasto: 'cena', ricetta_id: null, nota: 'Cena fuori', porzioni: null, cucinata_il: null },
    );
    await t.entra();
    await p.waitForSelector('.diario .proposta');

    assert.deepStrictEqual(await p.locator('.barra-basso a').allInnerTexts(), ['Diario', 'Menù', 'Dispensa', 'Ricette'], 'ordine della barra');
    assert.strictEqual(await p.locator('.diario .settimana p').innerText(), 'Oggi', 'oggi senza data per esteso');
    await t.foto('diario-vuoto');

    // una voce del menù si conferma con un tocco e segna la ricetta come cucinata
    await p.click('.proposta:has-text("Tamago") button');
    await p.waitForSelector('.pasto-diario .riga-voce:has-text("Tamago")');
    assert.ok(stato.piano.find((x) => x.id === 'p901').cucinata_il, 'la voce del menù risulta cucinata');
    assert.strictEqual(await p.locator('.proposta').count(), 1);

    // ricetta a porzioni, con l'alternativa in grammi
    await p.click('[aria-label="Aggiungi a colazione"]');
    await p.click('.viste button:has-text("Ricette")');
    await p.click('.ricette button:has-text("Pancake")');
    await p.fill('#quanto', '2');
    assert.match(await p.locator('.anteprima').innerText(), /276 kcal/);
    await p.click('.viste button:has-text("Grammi")');
    assert.match(await p.locator('.anteprima').innerText(), /138 kcal/, 'in grammi parte dal peso di una porzione');
    await p.click('.viste button:has-text("Porzioni")');
    await p.fill('#quanto', '2');
    await p.click('button[type=submit]');
    await p.waitForSelector('.pasto-diario .riga-voce:has-text("Pancake")');

    // alimento a pezzi
    await p.click('[aria-label="Aggiungi a merenda del mattino"]');
    await p.click('.viste button:has-text("Alimenti")');
    await p.fill('#cerca-diario', 'uov');
    await p.click('.ricette button:has-text("Uova")');
    await p.fill('#quanto', '2');
    await p.click('button[type=submit]');
    await p.waitForSelector('.pasto-diario .riga-voce:has-text("Uova")');

    // una nota del menù apre la voce a mano con il nome già scritto
    await p.click('.proposta:has-text("Cena fuori") button');
    assert.strictEqual(await p.inputValue('#nome-mano'), 'Cena fuori');
    await p.fill('#mano-kcal', '850');
    await p.fill('#mano-proteine_g', '35');
    await p.click('button[type=submit]');
    await p.waitForSelector('.pasto-diario .riga-voce:has-text("Cena fuori")');
    assert.strictEqual(await p.locator('.proposta').count(), 0);

    // obiettivi: un giorno, copiato su tutti, poi resi uguali per la settimana
    await p.click('text=Obiettivi');
    await p.click('.obiettivi-giorni .riga-voce >> nth=0');
    await p.fill('#g1-kcal', '2100');
    await p.fill('#g1-proteine_g', '140');
    await p.click('text=Copia su tutti i giorni');
    await p.check('.interruttore input');
    assert.strictEqual(await p.inputValue('#sett-kcal'), '2100', 'il valore fisso parte da quello dei giorni');
    await t.foto('obiettivi');
    await p.click('.salva-obiettivi');
    await p.waitForSelector('.diario .riepilogo .misura');
    assert.match(await p.locator('.riepilogo').innerText(), /1\.593[\s\S]*ne restano 507 su 2\.100/);
    await t.foto('diario-giorno');

    // modifica: i valori seguono la quantità
    await p.click('.riga-voce:has-text("Pancake")');
    await p.fill('.pannello-voce input', '3');
    await p.click('.pannello-voce button[type=submit]');
    await p.waitForFunction(() => /3 porzioni/.test(document.querySelector('.diario')?.textContent ?? ''));
    const pancake = stato.diario.find((x) => /Pancake/.test(x.nome));
    assert.deepStrictEqual([pancake.quantita, pancake.kcal, pancake.carboidrati_g], [3, 414, 46.5]);

    // spostare di pasto, riaggiungere dai recenti, togliere
    await p.click('.riga-voce:has-text("Uova")');
    await p.selectOption('.pannello-voce select', 'merenda_pomeriggio');
    await p.click('.pannello-voce button[type=submit]');
    await p.waitForFunction(() => !document.querySelector('.pannello-voce'));
    assert.strictEqual(stato.diario.find((x) => /Uova/.test(x.nome)).pasto, 'merenda_pomeriggio');
    await p.click('[aria-label="Aggiungi a cena"]');
    await p.click('.ricette.semplice button:has-text("Uova")');
    await p.waitForSelector('.diario .riepilogo');
    assert.strictEqual(stato.diario.length, 5);
    await p.click('.pasto-diario:has(h2:text-is("Cena")) .riga-voce:has-text("Uova")');
    await p.click('text=Togli dal diario');
    await p.waitForFunction(() => document.querySelectorAll('.riga-voce').length === 4);

    // settimana
    await p.click('.viste button:has-text("Settimana")');
    await p.waitForSelector('.giorni-settimana');
    await t.foto('diario-settimana');

    // menù con le merende; l'elenco ricette ha il suo indirizzo
    await p.click('.barra-basso a:has-text("Menù")');
    await p.waitForSelector('.menu .giorno');
    assert.deepStrictEqual(await p.locator('.giorno >> nth=0').locator('h3').allInnerTexts(), ['Colazione', 'Merenda', 'Pranzo', 'Merenda', 'Cena']);
    await p.click('.barra-basso a:has-text("Ricette")');
    await p.waitForSelector('.ricette a');
    assert.strictEqual(await p.evaluate(() => location.hash), '#/ricette');

    assert.strictEqual(chiamate.filter((c) => c[0] === 'diario+').length, 5);
    assert.deepStrictEqual(t.errori, [], 'nessun errore JavaScript');
  } finally {
    await t.chiudi();
  }
};
