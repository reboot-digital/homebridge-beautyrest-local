'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');
const { COMMANDS } = require('../bed');
const sides = [{ name: 'Side A', id: 'aabbccddeeff' }, { name: 'Side B', id: '112233445566' }];
async function setup(config = { sides }, send = async () => {}) {
  // Use real Homebridge/HAP accessories, with only the hardware transport replaced.
  const apiPath = path.join(path.dirname(require.resolve(process.env.BEAUTYREST_TEST_HOMEBRIDGE || 'homebridge')), 'api.js');
  const { HomebridgeAPI } = await import(pathToFileURL(apiPath).href);
  const api = new HomebridgeAPI();
  const registered = [], removed = [], updated = [], messages = [];
  let Platform;
  api.registerPlatform = (plugin, alias, implementation) => {
    assert.equal(plugin, 'homebridge-beautyrest-local'); assert.equal(alias, 'BeautyrestLocal'); Platform = implementation;
  };
  api.registerPlatformAccessories = (plugin, alias, accessories) => registered.push(...accessories);
  api.unregisterPlatformAccessories = (plugin, alias, accessories) => removed.push(...accessories);
  api.updatePlatformAccessories = accessories => updated.push(...accessories);
  const sandbox = { module: { exports: {} }, require: () => ({ COMMANDS, send }), setTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8'), sandbox);
  sandbox.module.exports(api);
  const log = Object.fromEntries(['info','warn','error'].map(level => [level, message => messages.push({ level, message })]));
  const platform = new Platform(log, config, api);
  return { api, platform, registered, removed, updated, messages };
}
function control(fixture, name) {
  const accessory = fixture.registered.find(a => a.displayName === name);
  return accessory.getService(fixture.api.hap.Service.Switch).getCharacteristic(fixture.api.hap.Characteristic.On);
}
test('real HAP registration exposes twelve switches per side without hardware traffic', async () => {
  let calls = 0;
  const f = await setup(undefined, async () => calls++);
  f.api.emit('didFinishLaunching');
  assert.equal(f.registered.length, 24);
  assert.equal(new Set(f.registered.map(a => a.UUID)).size, 24);
  for (const accessory of f.registered) {
    const on = accessory.getService(f.api.hap.Service.Switch).getCharacteristic(f.api.hap.Characteristic.On);
    assert.equal(await on.handleGetRequest(), false);
  }
  assert.equal(calls, 0);
});
test('empty, duplicate, malformed and excessive sides register nothing', async () => {
  for (const config of [{}, { sides: [] }, { sides: [sides[0], sides[0]] }, { sides: [{ name: ' ', id: sides[0].id }] }, { sides: [sides[0], sides[1], sides[0]] }, { sides: [{ name: 'Side', id: 'invalid' }] }]) {
    const f = await setup(config); f.api.emit('didFinishLaunching');
    assert.equal(f.registered.length, 0); assert.ok(f.messages.some(m => m.level === 'error'));
  }
});
test('cached accessories keep UUIDs across rename and stale controls are removed', async () => {
  const old = await setup(); old.api.emit('didFinishLaunching');
  const next = await setup({ sides: [{ ...sides[0], name: 'Renamed' }] });
  for (const accessory of old.registered) next.platform.configureAccessory(accessory);
  next.api.emit('didFinishLaunching');
  assert.equal(next.registered.length, 0); assert.equal(next.removed.length, 12); assert.equal(next.updated.length, 12);
  assert.ok(next.updated.every(a => a.displayName.startsWith('Renamed ')));
});
test('momentary writes reset; false writes are no-ops; same side is busy while another side works', async () => {
  let release;
  const calls = [];
  const f = await setup(undefined, async (id, command) => {
    calls.push([id, command]);
    if (command === 'headUp') await new Promise(resolve => { release = resolve; });
  });
  f.api.emit('didFinishLaunching');
  const on = control(f, 'Side A Head Up');
  await on.handleSetRequest(false); assert.equal(calls.length, 0);
  const first = on.handleSetRequest(true);
  await assert.rejects(control(f, 'Side A Flat').handleSetRequest(true), error => error === f.api.hap.HAPStatus.RESOURCE_BUSY || error.hapStatus === f.api.hap.HAPStatus.RESOURCE_BUSY);
  await control(f, 'Side B Flat').handleSetRequest(true);
  release(); await first; await delay(480);
  assert.equal(on.value, false); assert.equal(f.platform.active.size, 0);
  assert.deepEqual(calls, [[sides[0].id, 'headUp'], [sides[1].id, 'flat']]);
});
test('hardware failures return HAP error, reset the switch and omit network identifiers from logs', async () => {
  const f = await setup(undefined, async () => { throw new Error('private address 192.0.2.1 aabbccddeeff'); });
  f.api.emit('didFinishLaunching');
  const on = control(f, 'Side A Flat');
  await assert.rejects(on.handleSetRequest(true)); await delay(480);
  assert.equal(on.value, false); assert.equal(f.platform.active.size, 0);
  assert.ok(f.messages.some(m => m.level === 'warn'));
  assert.ok(!JSON.stringify(f.messages).includes('192.0.2.1'));
  assert.ok(!JSON.stringify(f.messages).includes(sides[0].id));
});
