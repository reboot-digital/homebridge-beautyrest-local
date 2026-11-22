#!/usr/bin/env node
'use strict';
// Read-only mDNS discovery. Never connects to TCP or sends a bed command.
const { Bonjour } = require('bonjour-service');
const { isIPv4 } = require('node:net');
const found = new Set();
let bonjour, browser, done = false;
const timeout = setTimeout(finish, 10000);
function finish(error) {
  if (done) return;
  done = true;
  clearTimeout(timeout);
  browser?.stop();
  bonjour?.destroy();
  if (error) {
    console.error('Discovery failed. Check local network access and multicast permissions.');
    process.exitCode = 1;
  } else if (!found.size) console.log('No compatible controller advertisements found. Check power and Wi-Fi.');
}
process.once('SIGINT', () => finish());
process.once('SIGTERM', () => finish());
console.log('Listening for local Keeson controllers for 10 seconds. No bed commands are sent.');
console.log('Keep controller IDs private; do not include them in public issues.');
try {
  bonjour = new Bonjour({}, error => queueMicrotask(() => finish(error)));
  browser = bonjour.find({ type: 'keeson', protocol: 'tcp' }, service => {
    if (done || service.port !== 5000 || !service.addresses?.some(isIPv4)) return;
    try {
      const id = String(JSON.parse(String(service.txt?.bedinfo ?? '')).device_id ?? '').toLowerCase();
      if (!/^[0-9a-f]{12}$/.test(id) || found.has(id)) return;
      found.add(id);
      console.log('Controller ID: ' + id);
    } catch { /* Ignore incompatible advertisements. */ }
  });
} catch (error) { finish(error); }
