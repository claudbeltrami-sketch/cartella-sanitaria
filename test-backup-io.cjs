const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
global.window = {};
vm.runInThisContext(fs.readFileSync(__dirname + '/backup-io.js', 'utf8'));
const io = window.lumenBackupIO;
const streamed = raw => ({ size: 64 * 1024 * 1024,
  slice: (start, end) => new Blob([raw.slice(start, end)]) });
(async () => {
  const packet = { tipo: 'BELTRAMI_BACKUP_COMPLETO_V1', versione: 1,
    extra: { futureMetadata: true }, contenuto: { localStorage: { test: 'à " \\' },
      cartelle: [], originali: [{ id: 'test', blob: 'data:text/plain;base64,YQ==' }],
      firme_da_trasferire: [], cartella_visibile: {} } };
  const file = io.toFile(packet, 'test.json');
  assert.deepEqual(await io.read(file), packet);
  assert.deepEqual(JSON.parse(JSON.stringify(await io.read(streamed(JSON.stringify(packet)), x => x))), packet);
  const absent = await io.read(streamed('{"tipo":"BELTRAMI_BACKUP_COMPLETO_V1"}'));
  assert.equal(absent.contenuto, undefined);
  await assert.rejects(io.read(streamed(JSON.stringify(packet).slice(0, -1))));
  await assert.rejects(io.read(streamed(JSON.stringify(packet) + 'false')));
  await assert.rejects(io.read(streamed(JSON.stringify(packet)), () => { throw Error('Invalid attachment'); }));
  const escaped = { tipo: packet.tipo, contenuto: packet.contenuto,
    metadata: 'x'.repeat(1024 * 1024 - 240) + 'à😀\\"fine' };
  assert.deepEqual(JSON.parse(JSON.stringify(await io.read(streamed(JSON.stringify(escaped)), x => x))), escaped);
  const handoff = { tipo: 'OTHER_PACKET', value: [1, 'à'] };
  assert.deepEqual(JSON.parse(await io.toFile(handoff, 'small.json').text()), handoff);
  console.log('PASS: V1 compatibility, streaming, escapes, metadata, invalid/truncated files, other packet formats');
})().catch(error => { console.error(error); process.exitCode = 1; });
