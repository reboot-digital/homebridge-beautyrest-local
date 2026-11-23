'use strict';
const { Bonjour } = require('bonjour-service');
const { isIPv4 } = require('node:net');

// Discovery only: no TCP connections, status requests or motor commands.
function createScanner({ BonjourClass = Bonjour, durationMs = 10000 } = {}) {
  let current;
  let cancel = () => {};
  function scan() {
    if (current) return current;
    current = new Promise((resolve, reject) => {
      const ids = new Set();
      let bonjour, browser, done = false;
      const timer = setTimeout(() => finish(), durationMs);
      function finish(error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { browser?.stop(); } catch { /* Still close the mDNS instance. */ }
        try { bonjour?.destroy(); } catch { /* Do not leak identifying errors. */ }
        if (error) reject(new Error('Discovery failed. Check local network and multicast access.'));
        else resolve([...ids].sort().map(id => ({ id })));
      }
      cancel = () => finish(new Error('Cancelled'));
      try {
        bonjour = new BonjourClass({}, error => queueMicrotask(() => finish(error)));
        browser = bonjour.find({ type: 'keeson', protocol: 'tcp' }, service => {
          if (done || ids.size >= 64 || service.port !== 5000 || !service.addresses?.some(isIPv4)) return;
          try {
            const id = String(JSON.parse(String(service.txt?.bedinfo ?? '')).device_id ?? '').toLowerCase();
            if (/^[0-9a-f]{12}$/.test(id)) ids.add(id);
          } catch { /* Ignore unrelated or malformed advertisements. */ }
        });
      } catch (error) { finish(error); }
    }).finally(() => { current = undefined; });
    return current;
  }
  return { scan, cancel: () => cancel() };
}
module.exports = { createScanner };
