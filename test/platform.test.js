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
  api.registerPlatformAccessories = (plugin, alias, accessories) => {
    for (const accessory of accessories) {
      accessory._associatedPlugin = plugin;
      accessory._associatedPlatform = alias;
    }
    registered.push(...accessories);
  };
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
test('real HAP registration exposes fourteen switches per side without hardware traffic', async () => {
  let calls = 0;
  const f = await setup(undefined, async () => calls++);
  f.api.emit('didFinishLaunching');
  assert.equal(f.registered.length, 28);
  assert.equal(new Set(f.registered.map(a => a.UUID)).size, 28);
  for (const accessory of f.registered) {
    const on = accessory.getService(f.api.hap.Service.Switch).getCharacteristic(f.api.hap.Characteristic.On);
    assert.equal(await on.handleGetRequest(), false);
  }
  assert.equal(calls, 0);
});
test('unconfigured or invalid platforms stay inactive and preserve cached accessories', async () => {
  const previous = await setup(); previous.api.emit('didFinishLaunching');
  for (const config of [null, {}, { sides: null }, { sides: [] }, { sides: [null] }, { sides: [sides[0], sides[0]] }, { sides: [{ name: ' ', id: sides[0].id }] }, { sides: [sides[0], sides[1], sides[0]] }, { sides: [{ name: 'Side', id: 'invalid' }] }]) {
    let calls = 0;
    const f = await setup(config, async () => calls++);
    for (const accessory of previous.registered) f.platform.configureAccessory(accessory);
    f.api.emit('didFinishLaunching');
    assert.equal(f.registered.length, 0);
    assert.equal(f.removed.length, 0);
    assert.equal(f.updated.length, 0);
    assert.equal(calls, 0);
    assert.ok(f.messages.some(m => m.level === 'error'));
  }
});
test('cached accessories keep UUIDs across rename and stale controls are removed', async () => {
  const old = await setup(); old.api.emit('didFinishLaunching');
  const next = await setup({ sides: [{ ...sides[0], name: 'Renamed' }] });
  for (const accessory of old.registered) next.platform.configureAccessory(accessory);
  next.api.emit('didFinishLaunching');
  assert.equal(next.registered.length, 0); assert.equal(next.removed.length, 14); assert.equal(next.updated.length, 14);
  assert.ok(next.updated.every(a => a.displayName.startsWith('Renamed ')));
  for (const accessory of next.updated) {
    assert.ok(old.registered.includes(accessory));
    const serialized = accessory.constructor.serialize(accessory);
    assert.equal(serialized.UUID, accessory.UUID);
    if (typeof accessory.updateDisplayName === 'function') assert.equal(serialized.displayName, accessory.displayName);
    assert.equal(accessory.getService(next.api.hap.Service.Switch).getCharacteristic(next.api.hap.Characteristic.Name).value, accessory.displayName);
  }
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

test('upgrade adds only Snore and timer to each side and preserves all existing accessories', async () => {
  const old = await setup(); old.api.emit('didFinishLaunching');
  const previous = old.registered.filter(a => !a.displayName.endsWith(' Snore') && !a.displayName.endsWith(' Massage Timer Cycle'));
  assert.equal(previous.length, 24);
  const next = await setup();
  for (const accessory of previous) next.platform.configureAccessory(accessory);
  next.api.emit('didFinishLaunching');
  assert.equal(next.removed.length, 0);
  assert.equal(next.registered.length, 4);
  assert.deepEqual(next.registered.map(a => a.displayName).sort(), ['Side A Massage Timer Cycle','Side A Snore','Side B Massage Timer Cycle','Side B Snore']);
});
test('new switches forward the command once and reset to Off', async () => {
  const calls = [];
  const f = await setup(undefined, async (id, command) => calls.push([id, command]));
  f.api.emit('didFinishLaunching');
  for (const [suffix, command] of [['Snore','snore'], ['Massage Timer Cycle','massageTimer']]) {
    const on = control(f, 'Side A ' + suffix);
    await on.handleSetRequest(true); await delay(480);
    assert.equal(on.value, false);
    assert.deepEqual(calls.at(-1), [sides[0].id, command]);
  }
  assert.equal(calls.length, 2);
});

test('per-side selections remove only explicitly disabled controls and preserve retained identities', async () => {
  const old = await setup(); old.api.emit('didFinishLaunching');
  const next = await setup({ sides: [{ ...sides[0], controls: { massage: false, massageTimer: false, flat: true } }, sides[1]] });
  for (const accessory of old.registered) next.platform.configureAccessory(accessory);
  next.api.emit('didFinishLaunching');
  assert.equal(next.registered.length, 0);
  assert.deepEqual(next.removed.map(a => a.displayName).sort(), ['Side A Massage Timer Cycle', 'Side A Massage Toggle']);
  assert.equal(next.platform.cached.size, 28);
  assert.equal(next.updated.length, 0);
  const restore = await setup();
  for (const accessory of old.registered.filter(a => !next.removed.includes(a))) restore.platform.configureAccessory(accessory);
  restore.api.emit('didFinishLaunching');
  assert.equal(restore.removed.length, 0);
  assert.equal(restore.registered.length, 2);
  assert.deepEqual(restore.registered.map(a => a.UUID).sort(), next.removed.map(a => a.UUID).sort());
});

test('omitted and empty selections enable all controls; all false exposes none without hardware traffic', async () => {
  const full = await setup({ sides: [{ ...sides[0], controls: {} }] }); full.api.emit('didFinishLaunching');
  assert.equal(full.registered.length, 14);
  let calls = 0;
  const disabled = Object.fromEntries(Object.keys(COMMANDS).map(key => [key, false]));
  const none = await setup({ sides: [{ ...sides[0], controls: disabled }] }, async () => calls++);
  for (const accessory of full.registered) none.platform.configureAccessory(accessory);
  none.api.emit('didFinishLaunching');
  assert.equal(none.registered.length, 0); assert.equal(none.removed.length, 14); assert.equal(calls, 0);
});

test('invalid selections preserve all cached controls instead of silently removing them', async () => {
  const old = await setup(); old.api.emit('didFinishLaunching');
  for (const controls of [null, false, [], 'flat', { flat: 'false' }, { flat: null }, { Flat: false }, { unknown: false }]) {
    let calls = 0;
    const f = await setup({ sides: [{ ...sides[0], controls }, sides[1]] }, async () => calls++);
    for (const accessory of old.registered) f.platform.configureAccessory(accessory);
    f.api.emit('didFinishLaunching');
    assert.equal(f.registered.length, 0); assert.equal(f.removed.length, 0); assert.equal(f.updated.length, 0); assert.equal(calls, 0);
    assert.ok(f.messages.some(m => m.level === 'error'));
  }
});

test('settings GUI offers all known controls, enabled by default and optional', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.schema.json')));
  const side = schema.schema.properties.sides.items;
  assert.ok(!side.required.includes('controls'));
  assert.deepEqual(Object.keys(side.properties.controls.properties).sort(), Object.keys(COMMANDS).sort());
  for (const property of Object.values(side.properties.controls.properties)) {
    assert.equal(property.type, 'boolean'); assert.equal(property.default, true);
  }
});
