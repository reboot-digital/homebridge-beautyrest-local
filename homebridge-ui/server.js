'use strict';
const { createScanner } = require('../scripts/discovery');

(async () => {
  const { HomebridgePluginUiServer, RequestError } = await import('@homebridge/plugin-ui-utils');
  class UiServer extends HomebridgePluginUiServer {
    constructor() {
      super();
      const scanner = createScanner();
      this.onRequest('/discover', async () => {
        try { return await scanner.scan(); }
        catch { throw new RequestError('Discovery failed. Check bed Wi-Fi and multicast access.', { status: 503 }); }
      });
      process.once('SIGTERM', () => { scanner.cancel(); process.exit(0); });
      process.once('disconnect', () => { scanner.cancel(); process.exit(0); });
      this.ready();
    }
  }
  new UiServer();
})().catch(() => { process.exitCode = 1; });
