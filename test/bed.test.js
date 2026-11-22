'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { createClient, encode, COMMANDS } = require('../bed');
const ID = 'aabbccddeeff';
const service = (id = ID) => ({ port: 5000, txt: { bedinfo: JSON.stringify({ device_id: id }) }, addresses: ['::1', '127.0.0.1'] });
function discovery(services = [service()], failure) {
  const calls = { stopped: 0, destroyed: 0 };
  class FakeBonjour {
    constructor(options, onError) { if (failure) queueMicrotask(() => onError(failure)); }
    find(options, callback) {
      assert.deepEqual(options, { type: 'keeson', protocol: 'tcp' });
      queueMicrotask(() => services.forEach(callback));
      return { stop() { calls.stopped++; } };
    }
    destroy() { calls.destroyed++; }
  }
  return { BonjourClass: FakeBonjour, calls };
}
function status(head = 0, foot = 0) {
  const frame = Buffer.alloc(27);
  frame[0] = 0xaa; frame[1] = 0x83; frame[3] = 23;
  frame[11] = head; frame[12] = foot; frame[26] = 0x55;
  frame[25] = ~frame.subarray(1, 25).reduce((sum, byte) => sum + byte, 0) & 255;
  return frame;
}
async function controller(t, respond) {
  const sockets = new Set();
  const frames = [];
  let connections = 0;
  const server = net.createServer(socket => {
    const connection = ++connections;
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    let input = Buffer.alloc(0);
    socket.on('data', chunk => {
      input = Buffer.concat([input, chunk]);
      while (input.length >= 14) {
        const frame = input.subarray(0, 14); input = input.subarray(14);
        const code = frame.readUInt32LE(7);
        frames.push({ code, time: performance.now(), connection });
        respond(socket, code, frames, connection);
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  const client = createClient({ ...discovery(), port: server.address().port, responseMs: 80, massageDelayMs: 1 });
  return { client, frames, port: server.address().port };
}
test('discovery ignores wrong IDs, ports, malformed TXT and IPv6-only devices; cleans up once', async () => {
  const fake = discovery([
    { ...service(), txt: { bedinfo: '{' } }, service('000000000000'),
    { ...service(), port: 80 }, { ...service(), addresses: ['::1'] }, service(ID.toUpperCase()), service(),
  ]);
  assert.equal(await createClient(fake).discover(ID), '127.0.0.1');
  assert.deepEqual(fake.calls, { stopped: 1, destroyed: 1 });
});
test('discovery timeout and error clean resources', async () => {
  for (const failure of [undefined, new Error('mDNS failed')]) {
    const fake = discovery([], failure);
    await assert.rejects(createClient({ ...fake, discoveryMs: 10 }).discover(ID));
    assert.deepEqual(fake.calls, { stopped: 1, destroyed: 1 });
  }
});
test('all twelve controls retain known protocol codes and frame checksums', () => {
  assert.equal(Object.keys(COMMANDS).length, 12);
  assert.equal(encode(COMMANDS.headUp.code).toString('hex'), 'aa03000a00040101000000f9f355');
  assert.equal(encode(COMMANDS.flat.code).readUInt32LE(7), 0x08000000);
  assert.equal(COMMANDS.preset1.name, 'Position 1');
});
test('fragmented status, junk prefix and coalesced invalid frame are handled', async t => {
  const { client } = await controller(t, socket => {
    const bad = status(); bad[25] ^= 1;
    socket.write(Buffer.concat([Buffer.from([1, 2]), bad, status().subarray(0, 9)]));
    setTimeout(() => socket.write(status().subarray(9)), 5);
  });
  assert.deepEqual(await client.exchange('127.0.0.1', 0), status());
});
test('invalid checksum, short reply, silent peer and oversized input fail within deadline', async t => {
  for (const reply of [Buffer.alloc(0), encode(0), Buffer.alloc(513), (() => { const f = status(); f[25] ^= 1; return f; })()]) {
    const { client } = await controller(t, socket => socket.write(reply));
    await assert.rejects(client.exchange('127.0.0.1', 0));
  }
});
test('manual movement ignores early status and sends RELEASE after the full 650ms hold', async t => {
  const { client, frames } = await controller(t, socket => socket.write(status()));
  await client.send(ID, 'headUp');
  assert.deepEqual(frames.map(f => f.code), [1, 0]);
  assert.ok(frames[1].time - frames[0].time >= 625);
});
test('broken movement connection triggers fresh RELEASE, never a movement retry', async t => {
  const { client, frames } = await controller(t, (socket, code) => code ? socket.destroy() : socket.write(status()));
  await assert.rejects(client.send(ID, 'lumbarUp'));
  assert.deepEqual(frames.map(f => f.code), [0x40, 0]);
  assert.notEqual(frames[0].connection, frames[1].connection);
});
test('same-side overlap is rejected; another side may run; gate clears after success', async t => {
  const { port, frames } = await controller(t, socket => setTimeout(() => socket.write(status()), 10));
  const client = createClient({ ...discovery([service(), service('112233445566')]), port });
  const first = client.send(ID, 'flat');
  await assert.rejects(client.send(ID.toUpperCase(), 'light'), /busy/);
  await Promise.all([first, client.send('112233445566', 'zeroG')]);
  await client.send(ID, 'light');
  assert.deepEqual(frames.map(frame => frame.code).sort((a,b) => a-b), [0x1000, 0x20000, 0x8000000]);
});
test('invalid ID and unknown commands do not start discovery', async () => {
  let touched = false;
  const client = createClient({ BonjourClass: class { constructor() { touched = true; } } });
  await assert.rejects(client.send('bad', 'flat'), /Invalid/);
  await assert.rejects(client.send(ID, '__proto__'), /Unknown/);
  assert.equal(touched, false);
});
test('massage toggles both motors on then drains both to zero', async t => {
  let head = 0, foot = 0;
  const { client } = await controller(t, (socket, code) => {
    const previous = status(head, foot);
    if (code === 0x800) head++;
    if (code === 0x400) foot++;
    if (code === 0x800000) head = Math.max(0, head - 1);
    if (code === 0x1000000) foot = Math.max(0, foot - 1);
    socket.write(previous); // Button replies may contain the preceding state.
  });
  await client.send(ID, 'massage'); assert.deepEqual([head, foot], [1, 1]);
  head = 3; foot = 2;
  await client.send(ID, 'massage'); assert.deepEqual([head, foot], [0, 0]);
});
test('massage stops on no progress and releases the per-side gate after failure', async t => {
  const { client, frames } = await controller(t, socket => socket.write(status()));
  await assert.rejects(client.send(ID, 'massage'), /did not change/);
  assert.deepEqual(frames.map(f => f.code), [0, 0x800, 0]);
  await client.send(ID, 'flat');
});
