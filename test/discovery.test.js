'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScanner } = require('../scripts/discovery');
const advertisement = id => ({ port: 5000, addresses: ['127.0.0.1'], txt: { bedinfo: JSON.stringify({ device_id: id, private_extra: 'do not return' }) } });
function fake(services = [], failure) {
  const calls = { started: 0, stopped: 0, destroyed: 0 };
  class BonjourClass {
    constructor(_, onError) { if (failure) queueMicrotask(() => onError(new Error('private network details'))); }
    find(options, callback) {
      assert.deepEqual(options, { type: 'keeson', protocol: 'tcp' }); calls.started++;
      queueMicrotask(() => services.forEach(callback));
      return { stop() { calls.stopped++; } };
    }
    destroy() { calls.destroyed++; }
  }
  return { BonjourClass, calls, durationMs: 10 };
}
test('settings discovery filters advertisements, deduplicates IDs and returns no network metadata', async () => {
  const f = fake([advertisement('AABBCCDDEEFF'), advertisement('aabbccddeeff'), advertisement('112233445566'), advertisement('invalid'), { ...advertisement('000000000000'), port: 80 }, { ...advertisement('000000000000'), addresses: ['::1'] }, { ...advertisement('000000000000'), txt: { bedinfo: '{' } }]);
  const scanner = createScanner(f);
  const first = scanner.scan();
  assert.equal(first, scanner.scan());
  assert.deepEqual(await first, [{ id: '112233445566' }, { id: 'aabbccddeeff' }]);
  assert.deepEqual(f.calls, { started: 1, stopped: 1, destroyed: 1 });
  await scanner.scan(); assert.equal(f.calls.started, 2);
});
test('empty, failed and cancelled discovery clean resources without exposing private errors', async () => {
  const empty = fake(); assert.deepEqual(await createScanner(empty).scan(), []);
  for (const failure of [true, false]) {
    const f = fake([], failure); const scanner = createScanner(f); const pending = scanner.scan();
    if (!failure) scanner.cancel();
    await assert.rejects(pending, error => error.message.includes('Discovery failed') && !error.message.includes('private'));
    assert.deepEqual(f.calls, { started: 1, stopped: 1, destroyed: 1 });
  }
});
