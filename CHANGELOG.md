# Changelog

## 1.3.0 — 2026-11-22

- Add a native Snore preset switch for each configured side.
- Add Massage Timer Cycle, which sends the controller’s own timer-step command. No Homebridge countdown or unsupported fixed-duration claim.
- Expose 14 momentary controls per side (28 for two sides), preserving existing accessory identifiers.
- Allow up to six reducing massage-off steps, preserving no-progress errors, and test higher reported intensity levels.
- Add an owner-provided remote reference photo with EXIF/location metadata removed, plus a remote-function coverage table.
- Add command-delivery, failure-without-retry, momentary reset and upgrade tests for the two new controls.

Owner-confirmed on My Side: Snore recalled the expected position and stopped, and the native timer button started massage and behaved as expected. Exact 10/20/30-minute selection/expiry and new controls on the second side were not separately verified. Separate massage-zone/intensity controls and saving presets are not added by this version.

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
