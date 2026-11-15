// Esegue tutte le prove:  npm run build && npm run prova
// Avvia da solo `vite preview` sulla cartella dist/, lancia le prove una dopo l'altra e lo ferma.
// Per eseguirne una sola:  npm run prova -- dispensa
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PROVE = ['diario', 'dispensa', 'consiglio'];
const scelte = process.argv.slice(2).length ? process.argv.slice(2) : PROVE;

const risponde = () => new Promise((ok) => http.get('http://127.0.0.1:4173/ricettario/', (r) => { r.resume(); ok(true); }).on('error', () => ok(false)));
const aspetta = (ms) => new Promise((ok) => setTimeout(ok, ms));

(async () => {
  let server = null;
  if (!(await risponde())) {
    server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
    for (let k = 0; k < 40 && !(await risponde()); k++) await aspetta(250);
  }
  let fallite = 0;
  for (const nome of scelte) {
    const inizio = Date.now();
    try {
      await require(`./${nome}.cjs`)();
      console.log(`OK       ${nome} (${Math.round((Date.now() - inizio) / 1000)} s)`);
    } catch (e) {
      fallite++;
      console.log(`FALLITA  ${nome}: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
    }
  }
  server?.kill();
  console.log(fallite ? `${fallite} prove fallite. Le schermate sono in prove/schermate/.` : 'Tutte le prove sono passate.');
  process.exit(fallite ? 1 : 0);
})();
