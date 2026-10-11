// Lee quiniela.com.py/resultados con un navegador real y guarda resultados.json
import fs from 'node:fs';

const URL = 'https://www.quiniela.com.py/resultados';
const NOMBRES = ['TEMPRANERO', 'MATUTINO', 'VESPERTINO', 'NOCTURNO'];

// Busca "SORTEO <NOMBRE>" y toma las primeras 14 cifras de 3 dígitos que le siguen.
export function parse(text) {
  const up = text.toUpperCase();
  const pos = NOMBRES
    .map(n => ({ n, i: up.indexOf('SORTEO ' + n) }))
    .filter(x => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  const out = {};
  pos.forEach((x, k) => {
    const fin = k + 1 < pos.length ? pos[k + 1].i : text.length;
    const nums = text.slice(x.i, fin).match(/\b\d{3}\b/g) || [];
    if (nums.length >= 14) out[x.n.toLowerCase()] = nums.slice(0, 14);
  });
  return out;
}

async function main() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ locale: 'es-PY', timezoneId: 'America/Asuncion' });
  const jsons = [];
  page.on('response', async r => {
    try {
      if ((r.headers()['content-type'] || '').includes('json')) jsons.push(r.url());
    } catch {}
  });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => /SORTEO/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const text = await page.evaluate(() => document.body.innerText);
  await browser.close();

  const sorteos = parse(text);
  if (!Object.keys(sorteos).length) {
    console.log('No se encontraron sorteos. Respuestas JSON vistas:', jsons);
    console.log('Texto de la página (inicio):\n' + text.slice(0, 1500));
    process.exit(1);
  }

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date());
  let previo = {};
  try { previo = JSON.parse(fs.readFileSync('resultados.json', 'utf8')); } catch {}
  const base = previo.fecha === hoy ? (previo.sorteos || {}) : {};
  const data = { fecha: hoy, actualizado: new Date().toISOString(), sorteos: { ...base, ...sorteos } };
  fs.writeFileSync('resultados.json', JSON.stringify(data, null, 2) + '\n');
  console.log('Guardado:', Object.keys(sorteos).join(', '));
}

if (process.argv[2] === '--test') {
  console.log(JSON.stringify(parse(fs.readFileSync(0, 'utf8'))));
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}
