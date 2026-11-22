# Changelog

## 1.2.0 — 2026-11-22

First public release, based on the working local 1.1.1 plugin.

- Add installation, compatibility, privacy and troubleshooting documentation with actual Apple Home examples.
- Call preset 1 “Position 1” to avoid assuming it is saved as Lounge.
- Validate status reply size as well as header, trailer and outer checksum.
- Clean up discovery and TCP resources once, including error and timeout paths.
- Preserve the 650 ms manual nudge and RELEASE; attempt RELEASE on a new connection after manual-command failure without replaying movement.
- Reject concurrent commands to the same controller in the transport as well as the Homebridge controls.
- Add read-only controller-ID discovery utility.
- Add fake-controller and real Homebridge/HAP accessory tests and CI.
- Exclude private configuration, storage, caches and development files from the npm package.

The original local 1.0.0, 1.1.0 and 1.1.1 packages were private development versions. Do not treat their test storage or configuration as release material.
