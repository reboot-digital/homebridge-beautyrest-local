# Changelog

## Unreleased

- Add optional per-side names for Position 1 and Position 2. Blank or omitted labels keep existing names; labels do not change saved positions or accessory identifiers.
- Add controller-ID discovery instructions and preset-label explanations to the Homebridge configuration screen.
- Expand README discovery guidance with Homebridge Terminal instructions and network troubleshooting.

## 1.4.0 — 2026-11-23

- Add per-side control selection in Homebridge UI and JSON configuration. All 14 controls remain enabled by default; only explicit `false` selections remove accessories.
- Preserve existing accessory identifiers for enabled controls and use the same identifiers when re-enabling a control.
- Reject malformed or unknown selections without removing cached accessories.
- Explain the effect of disabling controls on scenes, Siri and automations, and add Apple Home View/Home Summaries setup guidance.
- Keep physical commands, saved presets, movement release and discovery behavior unchanged.

## 1.3.1 — 2026-11-23

- Cache discovered controller addresses in memory for up to 60 seconds to reduce repeated discovery; invalidate after communication failures without replaying commands.
- Use Homebridge’s supported accessory-name update API when available, retaining compatibility with Homebridge 1.x.
- Clarify that invalid configuration preserves existing accessories until settings are corrected; valid configuration still removes obsolete controls.
- Limit declared Node support to 22.12+ (22.x), 24.x and 26.x; remove end-of-life Node 20 from CI.
- Add the Homebridge verification badge, lead with UI installation, and document upgrades that preserve pairing.
- Preserve all 28 accessory identities, protocol commands, 650 ms manual movement and RELEASE recovery.

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
