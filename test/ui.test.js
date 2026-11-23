'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../homebridge-ui/public/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../homebridge-ui/public/ui.js'), 'utf8');
const copy = data => JSON.parse(JSON.stringify(data));
async function flush() { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); }
async function setup(configs = [], found = [{ id: 'aabbccddeeff' }]) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  let current = copy(configs), updates = 0, scans = 0;
  const events = {};
  const hb = {
    getPluginConfig: async () => copy(current),
    updatePluginConfig: async data => { current = copy(data); updates++; },
    getPluginConfigSchema: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '../config.schema.json'), 'utf8')),
    createForm: () => ({ end() {}, onChange(callback) { hb.change = callback; } }),
    addEventListener: (name, callback) => { events[name] = callback; },
    request: async route => { assert.equal(route, '/discover'); scans++; if (found instanceof Error) throw found; return found; },
    savePluginConfig: () => { throw new Error('Settings must not be auto-saved'); },
  };
  dom.window.homebridge = hb; await dom.window.eval(script);
  assert.equal(dom.window.document.getElementById('discover').disabled, true);
  events.ready(); await flush();
  const document = dom.window.document;
  return { dom, document, hb, state: () => ({ current, updates, scans }), edit: data => { current = copy(data); }, scan: async () => { document.getElementById('discover').click(); await flush(); } };
}
test('discovery fills empty sides without saving, replacing controllers or duplicating IDs', async t => {
  const f = await setup([], [{ id: 'aabbccddeeff' }, { id: '112233445566' }]); t.after(() => f.dom.window.close());
  await f.scan();
  f.document.querySelector('#discovery-results button').click(); await flush();
  assert.deepEqual(f.state().current[0].sides, [{ name: 'My Side', id: 'aabbccddeeff' }]);
  assert.equal(f.document.querySelectorAll('#discovery-results button').length, 1);
  f.document.querySelector('#discovery-results button').click(); await flush();
  assert.equal(f.state().current[0].sides[1].id, '112233445566');
  assert.equal(f.document.querySelectorAll('#discovery-results button').length, 0);
  assert.equal(f.state().updates, 2);
});
test('assignment reads current unsaved configuration and preserves preset labels, controls and bridge settings', async t => {
  const f = await setup([{ platform: 'BeautyrestLocal', sides: [{ name: 'Left', id: '112233445566' }] }]); t.after(() => f.dom.window.close());
  await f.scan();
  const edited = [{ platform: 'BeautyrestLocal', name: 'Updated', _bridge: { username: 'placeholder' }, sides: [{ name: 'His Side', id: '112233445566', preset1Name: 'Reading', controls: { massage: false } }, { name: 'Her Side', id: '', preset2Name: 'Lounge' }] }];
  f.edit(edited);
  f.document.querySelector('#discovery-results button').click(); await flush();
  edited[0].sides[1].id = 'aabbccddeeff';
  assert.deepEqual(f.state().current, edited);
});
test('stale assignment never overwrites a newly configured side', async t => {
  const f = await setup(); t.after(() => f.dom.window.close()); await f.scan();
  const edit = [{ platform: 'BeautyrestLocal', sides: [{ name: 'Existing', id: '112233445566' }] }]; f.edit(edit);
  f.document.querySelector('#discovery-results button').click(); await flush();
  assert.deepEqual(f.state().current, edit); assert.equal(f.state().updates, 0);
});
test('settings form edits preserve bridge metadata and can clear optional preset labels', async t => {
  const f = await setup([{ platform: 'BeautyrestLocal', _bridge: { username: 'placeholder' }, name: 'Bed', sides: [{ name: 'My Side', id: 'aabbccddeeff', preset1Name: 'Reading' }] }]);
  t.after(() => f.dom.window.close());
  f.hb.change({ name: 'Updated Bed', sides: [{ name: 'His Side', id: 'aabbccddeeff', controls: { massage: false } }] });
  await flush();
  assert.equal(f.state().current[0]._bridge.username, 'placeholder');
  assert.equal(f.state().current[0].name, 'Updated Bed');
  assert.equal(f.state().current[0].sides[0].preset1Name, undefined);
  assert.equal(f.state().current[0].sides[0].controls.massage, false);
});
test('empty and failed scans keep manual settings available and allow retry', async t => {
  for (const found of [[], new Error('private details')]) {
    const f = await setup([], found); t.after(() => f.dom.window.close()); await f.scan();
    assert.equal(f.document.getElementById('discover').disabled, false);
    assert.ok(f.document.getElementById('discovery-status').textContent.includes('manually'));
    assert.ok(!f.document.body.textContent.includes('private details'));
    assert.equal(f.state().updates, 0);
    await f.scan(); assert.equal(f.state().scans, 2);
  }
});
