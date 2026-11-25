const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const server = require('./local-server.cjs')(path.resolve(__dirname, '..'));

(async () => {
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const url = 'http://127.0.0.1:' + server.address().port + '/';
 const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args:['--no-sandbox']});
 try {
  for (const mobile of [false, true]) {
   const context = await browser.newContext({isMobile:mobile, hasTouch:mobile});
   await context.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
   let page = await context.newPage();
   await page.goto(url);
   await page.evaluate(() => window.lumenBatchCertApi.apply({nome:'TEST', cognome:'BOZZA', data_nascita:'1990-01-01'}));
   await page.locator('#mansione').fill('OPERATORE');
   await page.locator('#mansione').press('End');
   await page.locator('#mansione').press('A');
   await page.close();
   page = await context.newPage();
   await page.goto(url);
   await page.getByRole('button', {name:/Riprendi bozza · BOZZA TEST/}).click();
   assert.equal(await page.locator('#mansione').inputValue(),'OPERATOREA');
   await page.locator('#btnChiudiCartella').evaluate(b => b.click());
   await page.waitForFunction(() => document.getElementById('cartellaForm').classList.contains('hidden'));
   await page.reload();
   assert.equal(await page.locator('#bozzeVisita button').count(),0);
   await context.close();
  }
  console.log('Ripristino dopo chiusura e rimozione dopo archiviazione verificati su desktop e profilo mobile.');
 } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
