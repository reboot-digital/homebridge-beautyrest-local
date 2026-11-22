'use strict';

const { createConnection, isIPv4 } = require('node:net');
const { Bonjour } = require('bonjour-service');

const PORT = 5000;
const RELEASE = 0;
const MASSAGE_ZONES = [
  { name: 'head', up: 0x00000800, down: 0x00800000 },
  { name: 'foot', up: 0x00000400, down: 0x01000000 },
];
const NUDGE_MS = 650;
const COMMANDS = Object.freeze({
  light: { name: 'Bed Light Toggle', code: 0x00020000 },
  flat: { name: 'Flat', code: 0x08000000 },
  zeroG: { name: 'Zero G', code: 0x00001000 },
  preset1: { name: 'Position 1', code: 0x00002000 },
  preset2: { name: 'Position 2', code: 0x00004000 },
  headUp: { name: 'Head Up', code: 0x00000001, nudge: true },
  headDown: { name: 'Head Down', code: 0x00000002, nudge: true },
  feetUp: { name: 'Feet Up', code: 0x00000004, nudge: true },
  feetDown: { name: 'Feet Down', code: 0x00000008, nudge: true },
  lumbarUp: { name: 'Lumbar Up', code: 0x00000040, nudge: true },
  lumbarDown: { name: 'Lumbar Down', code: 0x00000080, nudge: true },
  massage: { name: 'Massage Toggle' },
});

function controllerId(service) {
  try {
    const info = JSON.parse(String(service.txt?.bedinfo ?? ''));
    return String(info.device_id ?? '').toLowerCase();
  } catch {
    return '';
  }
}

// Keeson TCP frame used by the Ergomotion remote. The checksum complements each byte sum.
function encode(code) {
  const frame = Buffer.from([0xaa, 0x03, 0x00, 0x0a, 0x00, 0x04, 0x01, 0, 0, 0, 0, 0, 0, 0x55]);
  frame.writeUInt32LE(code, 7);
  frame[11] = ~frame.subarray(5, 11).reduce((sum, byte) => sum + byte, 0) & 0xff;
  frame[12] = ~frame.subarray(1, 12).reduce((sum, byte) => sum + byte, 0) & 0xff;
  return frame;
}

// Dependencies and short deadlines can be injected by tests; normal operation uses LAN discovery.
function createClient({ BonjourClass = Bonjour, connect = createConnection, port = PORT,
  discoveryMs = 2600, responseMs = 1600, nudgeMs = NUDGE_MS, massageDelayMs = 400 } = {}) {
  const active = new Set();

  function discover(id) {
    return new Promise((resolve, reject) => {
      let bonjour;
      let browser;
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('Bed controller did not answer discovery')), discoveryMs);

      function finish(error, address) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        browser?.stop();
        bonjour?.destroy();
        if (error) reject(error);
        else resolve(address);
      }

      try {
        bonjour = new BonjourClass({}, error => queueMicrotask(() => finish(error)));
        browser = bonjour.find({ type: 'keeson', protocol: 'tcp' }, service => {
          if (service.port !== PORT || controllerId(service) !== id) return;
          const address = service.addresses?.find(isIPv4);
          if (address) queueMicrotask(() => finish(null, address));
        });
      } catch (error) {
        finish(error);
      }
    });
  }

  function exchange(address, code, holdMs = 0) {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: address, port });
      const deadline = setTimeout(() => finish(new Error('No status response from bed')), responseMs + holdMs);
      let received = Buffer.alloc(0);
      let settled = false;
      let releaseTimer;
      let awaitingRelease = holdMs > 0;

      function finish(error, status) {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        clearTimeout(releaseTimer);
        socket.destroy();
        if (error) reject(error);
        else resolve(status);
      }

      socket.once('connect', () => {
        socket.write(encode(code));
        if (awaitingRelease) {
          releaseTimer = setTimeout(() => {
            socket.write(encode(RELEASE), () => { awaitingRelease = false; });
          }, holdMs);
        }
      });
      socket.once('error', finish);
      socket.once('end', () => finish(new Error('Bed disconnected before returning status')));
      socket.once('close', () => finish(new Error('Bed connection closed before returning status')));
      socket.on('data', chunk => {
        received = Buffer.concat([received, chunk]);
        if (received.length > 512) return finish(new Error('Unexpected response from bed'));
        while (received.length >= 4) {
          if (received[0] !== 0xaa) {
            received = received.subarray(1);
            continue;
          }
          const length = 4 + received[3];
          if (received.length < length) return;
          const frame = received.subarray(0, length);
          received = received.subarray(length);
          const checksum = ~frame.subarray(1, -2).reduce((sum, byte) => sum + byte, 0) & 0xff;
          if (!awaitingRelease && frame.length === 27 && frame[1] === 0x83 && frame.at(-1) === 0x55 &&
              frame.at(-2) === checksum) return finish(null, frame);
        }
      });
    });
  }

  function massageState(status) {
    if (status.length !== 27) throw new Error('Unrecognized massage status frame');
    return { head: status[11] & 0x0f, foot: status[12] };
  }

  async function toggleMassage(address) {
    let state = massageState(await exchange(address, RELEASE));
    const turnOn = !state.head && !state.foot;
    for (const zone of MASSAGE_ZONES) {
      const targetReached = () => turnOn ? state[zone.name] > 0 : state[zone.name] === 0;
      for (let step = 0; step < 3 && !targetReached(); step++) {
        const previous = state[zone.name];
        await exchange(address, turnOn ? zone.up : zone.down);
        // A reply to a button press can contain the preceding state.
        await new Promise(resolve => setTimeout(resolve, massageDelayMs));
        state = massageState(await exchange(address, RELEASE));
        if (turnOn ? state[zone.name] <= previous : state[zone.name] >= previous) {
          throw new Error('Bed did not change the ' + zone.name + ' massage intensity');
        }
      }
      if (!targetReached()) throw new Error('Bed did not reach the requested ' + zone.name + ' massage state');
    }
  }

  async function send(id, command) {
    if (typeof id !== 'string' || !/^[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid controller ID');
    id = id.toLowerCase();
    if (!Object.hasOwn(COMMANDS, command)) throw new Error('Unknown bed command');
    if (active.has(id)) throw new Error('Bed controller is busy');
    active.add(id);
    try {
      const address = await discover(id);
      if (command === 'massage') return await toggleMassage(address);
      const { code, nudge } = COMMANDS[command];
      try {
        await exchange(address, code, nudge ? nudgeMs : 0);
      } catch (error) {
        if (nudge) {
          // A failed connection cannot guarantee a stop. Try RELEASE once on a fresh
          // connection, never replay the movement, and still report the original failure.
          try { await exchange(address, RELEASE); } catch { /* best effort only */ }
        }
        throw error;
      }
    } finally {
      active.delete(id);
    }
  }

  return { discover, exchange, send };
}

const client = createClient();
module.exports = { COMMANDS, encode, createClient, discover: client.discover, send: client.send };
