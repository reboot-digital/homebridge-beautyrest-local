# Beautyrest Local for Homebridge

[![Verified by Homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=flat)](https://github.com/homebridge/plugins/issues/1385)
[![Tests](https://github.com/reboot-digital/homebridge-beautyrest-local/actions/workflows/test.yml/badge.svg)](https://github.com/reboot-digital/homebridge-beautyrest-local/actions/workflows/test.yml)

**Your adjustable bed, in Apple Home. Local control. No relay subscription.**

Control one base or two independently paired sides of a compatible Beautyrest adjustable bed from Apple Home, Siri, and HomeKit scenes. Beautyrest Local sends commands directly to the bed’s Wi-Fi controllers on your home network. It does not need Alexa, a cloud account, or a subscription.

Built and maintained by **RebootDigital**. This is an independent community project, not an official Beautyrest, Keeson, Ergomotion, Apple, or Homebridge product.

[☕ Buy me a coffee](https://buymeacoffee.com/rebootdigital) · [Installation](#installation) · [Compatibility](#compatibility) · [Controls](#controls) · [Troubleshooting](#troubleshooting) · [Report an issue](https://github.com/reboot-digital/homebridge-beautyrest-local/issues)

## In Apple Home

Control each side from Apple Home. Side names are customizable; Apple Home may shorten longer tile labels.

<p>
  <img src="https://raw.githubusercontent.com/reboot-digital/homebridge-beautyrest-local/main/docs/images/apple-home-my-side.png" alt="Apple Home momentary switches for the first bed side" width="320">
  <img src="https://raw.githubusercontent.com/reboot-digital/homebridge-beautyrest-local/main/docs/images/apple-home-other-side.png" alt="Apple Home momentary switches for the second bed side" width="320">
</p>

**Every tile is a button, not a status indicator.** Switches return to Off after a command. Off does not mean that the bed is flat, its light is off, or massage is stopped.

### Physical remote reference

<img src="https://raw.githubusercontent.com/reboot-digital/homebridge-beautyrest-local/main/docs/images/beautyrest-black-remote.jpg" alt="Beautyrest Black remote used with the tested split-bed setup, showing Snore and massage timer buttons" width="220">

Beautyrest Black remote from the tested setup. See [remote button coverage](docs/REMOTE-CONTROLS.md) for supported functions. A matching remote alone does not establish compatibility.

## Compatibility

See the [model compatibility table and support-request process](docs/COMPATIBILITY.md). Requests are welcome; hardware access or a volunteer tester may be needed, and support is not guaranteed.

Physically tested on **one Beautyrest Black king bed with two independently controlled bases**, configured using the Beautyrest Black app. Both sides’ light toggles, Flat, Zero G, manual head/feet/lumbar adjustments, and massage start/stop were confirmed. Saved-position buttons sent commands and produced movement; the recalled position depends on what is stored in each base. Preset accuracy was not confirmed for every side and preset.

Other beds are **unconfirmed**, including other Beautyrest models and other Keeson/Ergomotion products. Matching brand names alone do not establish compatibility. The controller must advertise `_keeson._tcp` with a `bedinfo.device_id` and support the TCP command/status protocol on port 5000. Bluetooth-only bases are not supported.

Requirements:

- Homebridge **1.8.x or later 1.x**, or **2.x**; an existing Apple Home setup.
- Node.js **22.12+ (22.x), 24.x or 26.x**. Prefer a [currently supported Homebridge Node.js version](https://github.com/homebridge/homebridge/wiki/How-To-Update-Node.js).
- The bed already connected to Wi-Fi using its normal app.
- IPv4 connectivity from Homebridge to the controllers, plus mDNS/multicast discovery. Guest isolation and separate VLANs can prevent discovery.

A Home hub is needed for remote access and HomeKit automations under Apple’s normal requirements. The plugin itself sends commands only over the local network.

## Installation

The distribution package is named **`homebridge-beautyrest-local`** and the platform is **`BeautyrestLocal`**.

### Homebridge UI (recommended)

1. Open **Plugins** in Homebridge UI and search for **`homebridge-beautyrest-local`**.
2. Install **Beautyrest Local** by RebootDigital.
3. Add your controller IDs and side names using the settings below, then restart Homebridge.

If a broad search finds no results, use the full package name above.

### npm

On the Homebridge host, use your installation’s normal permissions:

```sh
npm install -g homebridge-beautyrest-local@1.4.0
```

### Manual download

Download the `.tgz` package from [Releases](https://github.com/reboot-digital/homebridge-beautyrest-local/releases), then install it on the Homebridge host:

```sh
npm install -g ./homebridge-beautyrest-local-1.4.0.tgz
```

Configure and restart Homebridge. Install only one copy of the plugin.

### Updating an existing installation

Use the plugin’s update option in Homebridge UI, then restart Homebridge. Keep your existing controller IDs and platform entry: normal updates preserve accessory identities and do not require pairing again. Apple Home can retain custom accessory names.

For the original private 1.1.1 development package, install the npm release in place once; that version does not check for public updates. Back up Homebridge before updating. Do not uninstall the plugin, reset Homebridge, or remove its cached accessories as an update step.

## Find your controller IDs

**Next release (not yet published):** click **Discover beds** above the settings form. After the 10-second scan, choose **Use for Side 1** or **Use for Side 2** to fill an empty side. Rename the side below, then Save and restart Homebridge. Already configured controllers are marked, and discovery will not replace an existing controller. It sends no bed commands. If no controller appears, use the manual steps below and check Wi-Fi/multicast connectivity.

The plugin discovers each base by its controller ID, so you do not need a fixed IP address. Each ID has **12 hexadecimal characters**. Discovered addresses are kept in memory for up to 60 seconds and discarded after communication failures; you still do not need fixed IP addresses. After installing the plugin, open **Homebridge UI → Terminal** on the Homebridge host (not a terminal on an unrelated computer) and run:

```sh
beautyrest-discover
```

The bed must already be connected to Wi-Fi and reachable from Homebridge. The utility listens to local mDNS advertisements for 10 seconds without moving the bed. Copy the value after **Controller ID:** into the matching side’s **Controller ID** field in plugin settings. One base needs one ID; two independent bases need two distinct IDs. Keep the reported IDs private.

If no controllers are found, check that the bases have power and Wi-Fi and that guest-network isolation, VLANs or multicast filtering are not blocking discovery. Do not substitute an IP address or guess an ID from the Wi-Fi MAC address.

For manual discovery on macOS, `dns-sd -B _keeson._tcp local.` lists services; resolve each advertised service with `dns-sd -L "SERVICE NAME" _keeson._tcp local.` and look for `bedinfo` → `device_id`. Press Control-C to stop browsing. Do not assume a controller ID is the same as a printed serial number or Wi-Fi MAC address.

With two bases, the order in discovery does not identify the physical side. Match IDs using your own app/controller information. If identification needs a command test, do it in person with the bed clear and the physical remote available.

## Configuration

In Homebridge UI, open **Beautyrest Local → Settings** and add one or two sides. Use short, distinct names such as **My Side / Other Side**, **His Side / Her Side**, **Left Side / Right Side**, or **Alex’s Side / Sam’s Side**. Save and restart Homebridge. For an isolated setup, use the UI’s child bridge option and pair that bridge in Apple Home.

Names become part of each control label, for example **My Side Flat** or **Her Side Head Up**. Choose phrases that are easy to recognize and say to Siri. For Left/Right labels, use a consistent viewpoint, such as lying in bed. Names do not identify the physical controller: match each ID to the correct base first.

Example platform entry for `config.json` (replace both example IDs):

```json
{
  "platform": "BeautyrestLocal",
  "name": "Beautyrest Local",
  "sides": [
    { "name": "My Side", "id": "aabbccddeeff" },
    { "name": "Other Side", "id": "112233445566" }
  ]
}
```

These IDs are placeholders. Add this object to your existing `platforms` array; do not replace your full Homebridge configuration. For one base, keep just one side entry. Names must be nonempty and controller IDs unique.

With all controls enabled, the plugin creates **14 switch accessories per side**, for 14 or 28 controls total. Move them to a dedicated room, such as **ErgoBed**, in Apple Home. Accessory identities are based on controller ID and command, so changing a side name keeps their identifiers. Apple Home can retain names you have customized there.

### Custom preset labels (next release; not yet published)

Each side has optional **Position 1 name** and **Position 2 name** fields. Leave them blank for the existing names, or enter names such as **Reading** and **Lounge** to match the positions saved in that base. The side name is included automatically: **My Side Reading**.

For JSON configuration, set `preset1Name` and/or `preset2Name` on the relevant side:

```json
{ "name": "My Side", "id": "aabbccddeeff", "preset1Name": "Reading", "preset2Name": "Lounge" }
```

Save and restart Homebridge. These labels only rename the two recall controls; they do not program a new position or overwrite the base’s saved presets. Set the positions using the physical remote or manufacturer app first. Renaming keeps the existing accessory identifiers. Apple Home may retain names you have customized there; adjust those names in Home if needed.

### Choose which controls appear

In Homebridge UI, open a side’s **Controls in Apple Home** settings and turn off any controls you do not want. Save and restart Homebridge. Each side can have a different selection. **All controls stay enabled by default**, including when updating an existing setup.

For JSON configuration, add a `controls` object to the relevant side. Only explicitly `false` controls are disabled; omitted controls stay enabled:

```json
{ "name": "My Side", "id": "aabbccddeeff", "controls": { "massage": false, "massageTimer": false } }
```

Control keys: `light`, `flat`, `zeroG`, `snore`, `preset1`, `preset2`, `headUp`, `headDown`, `feetUp`, `feetDown`, `lumbarUp`, `lumbarDown`, `massage`, `massageTimer`.

Disabling a control removes its accessory from Apple Home and Siri. If a scene or automation uses it, update that scene first. Re-enabling uses the same accessory identifier, but Apple Home may require you to restore its room, name or automation links. Controls that remain enabled keep their existing identities. This setting does not change the bed’s saved presets or physical remote.

### Keep Apple Home uncluttered

To keep controls available in their room, Siri and scenes while reducing clutter:

1. Put the bed controls in a dedicated room, such as **ErgoBed**.
2. Open each accessory’s settings and turn **Add to Home View** off for tiles you do not need on the main screen.
3. Open **Status** or **Status and Notifications**, where available, and turn **Include in Home Summaries** off. These are momentary controls, so their Off value is not a useful bed-status summary. See [Apple’s instructions](https://support.apple.com/en-us/105042).
4. Keep just your preferred controls or a few scenes, such as **Bed Flat**, in Home View.

These display preferences are set in Apple Home; the plugin cannot choose their defaults. Hiding tiles or summaries does not disable Siri, scenes or automations. Review any movement automations separately.

## Controls

| Button | Action |
| --- | --- |
| Bed Light Toggle | Toggles the under-bed light. It cannot reliably set or report On/Off. |
| Flat | Requests the controller’s Flat position. |
| Zero G | Requests the controller’s Zero G position. |
| Snore | Requests the controller’s Anti-Snore preset. |
| Position 1 | Recalls saved preset 1. The plugin does not save or overwrite it. |
| Position 2 | Recalls saved preset 2. The plugin does not save or overwrite it. |
| Head Up / Head Down | Brief head movement, then RELEASE. |
| Feet Up / Feet Down | Brief foot movement, then RELEASE. |
| Lumbar Up / Lumbar Down | Brief lumbar movement, then RELEASE. |
| Massage Toggle | Reads both motors; starts both if both are off, otherwise attempts to turn both off. |
| Massage Timer Cycle | Advances the controller’s built-in massage timer, like the remote’s timer button. It does not select a known duration from HomeKit. |

Manual adjustments use a **650 ms nudge** followed by RELEASE. This is not hold-to-move control. The plugin rejects overlapping commands to the same side; wait for the button to reset before pressing another. Different sides can operate independently.

Position and Flat/Zero G commands ask the base to run its own movement routine. There is no position percentage, motion sensor, obstruction detection, or separate emergency-stop accessory. Keep the normal remote available. A network failure can prevent delivery of RELEASE; the plugin attempts a fresh stop connection after a failed manual adjustment, but cannot guarantee a stop over a broken network.

### Siri and scenes

Because the controls are switches, Siri requests take the form **“Turn on My Side Flat.”** For a more natural phrase, create an Apple Home scene called **Bed Flat** that turns on the desired Flat switch(es), then say **“Set Bed Flat.”**

Use explicit positions for predictable scenes. Light and massage are toggles: repeating a scene containing them can reverse the previous result. Massage Timer Cycle also advances a selection, so it is best used as a button; HomeKit does not show the selected timer duration. Turning a switch Off does not send a bed command. Avoid unattended or repeating movement automations.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Configuration error after an update | Existing accessories are preserved but unavailable until settings are corrected. Check side names and controller IDs, then restart. |
| No controls after restart | Configure one or two sides with distinct 12-character hexadecimal IDs and nonempty names. Check the Homebridge log. |
| Communication failure | Confirm power/Wi-Fi, the controller ID, mDNS access and TCP 5000 connectivity from the Homebridge host. Fixed IPs do not replace discovery. |
| A button shows Off immediately | Expected: switches are momentary and do not show the physical state. |
| Another command is rejected | Wait for the current same-side command and reset to finish. |
| Position 1 looks like Flat | Check the preset saved on that particular base. “Position 1” does not guarantee Lounge. |
| Light scene behaves inconsistently | It is a toggle, without reliable state. Use it as a button rather than a stateful light. |
| A feature does nothing | Your controller or base may differ from the tested bed, or may lack that feature. Report the model and symptom. |
| Old controls remain | Check for a second plugin installation or platform entry. Back up Homebridge before removing cached accessories. |

If movement does not stop as expected, use the physical remote and stop testing. Do not repeatedly retry commands to diagnose a moving bed.

## Privacy and networking

No telemetry, analytics, external API, cloud login, or subscription is used by the plugin. Runtime traffic consists of local mDNS discovery and TCP commands/status replies. Package installation and updates use npm/GitHub as usual. Controller IDs remain in your local Homebridge configuration and accessory serial numbers.

The controller protocol is unencrypted and the plugin adds no controller authentication. Use a trusted home network. Do not forward TCP port 5000 or expose Homebridge/controller services to the public internet.

Before sharing an issue or screenshot, remove controller IDs, IP addresses, HomeKit PINs/QR codes, household names, access tokens, and your full `config.json`. Report only the model, app name, plugin/Homebridge/Node versions, command attempted, and a redacted error description.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm test
npm pack --dry-run
```

Tests use fake mDNS advertisements, loopback TCP controllers, and real Homebridge/HAP accessory classes with the hardware transport replaced. They do not discover or operate your bed. Tests cover framing, invalid responses, timeouts, movement release/recovery, massage progression, same-side concurrency, cached accessories, momentary resets, and configuration validation.

See [compatibility](docs/COMPATIBILITY.md) and [remote control coverage](docs/REMOTE-CONTROLS.md) for physical test results and remaining limitations.

## Support the project

If Beautyrest Local makes your setup easier, you can [buy RebootDigital a coffee](https://buymeacoffee.com/rebootdigital) to support future development. Donations are optional; the plugin is free and all features remain available to everyone.

## License

[MIT](LICENSE) © 2026 RebootDigital.
