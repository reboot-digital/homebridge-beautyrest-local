# Compatibility and new-model requests

## What is supported today?

Compatibility follows the **controller and protocol**, not the mattress brand or retail model name. This plugin currently implements one local Keeson TCP protocol. It does not detect the model, negotiate capabilities, or select different protocols automatically.

| Base/controller family | Status in this plugin | Evidence / next step |
| --- | --- | --- |
| Beautyrest Black, king with two independently controlled Wi-Fi bases, using the Beautyrest Black app | **Physically tested on one owner’s setup** | Lights, Flat, Zero G, manual head/feet/lumbar movement and massage start/stop confirmed on both sides. Saved presets produced movement, but full preset accuracy was not confirmed. Exact base SKU/year has not been recorded. |
| Another Beautyrest Black Wi-Fi base using the same app | **Candidate; unconfirmed** | Must match mDNS identity, TCP framing, response layout, movement RELEASE behavior and command mapping. The app name alone is not proof. |
| Beautyrest Black Luxury sold under newer/current model names | **Unknown** | Beautyrest reuses product branding across feature sets. Current product descriptions are not protocol specifications. Obtain the actual controller/app details. |
| Beautyrest BaseLogic Bronze, Silver, Gold, Platinum or Pearl; Beautyrest SmartMotion | **Unknown; not claimed as supported** | No model-specific hardware tests or matching controller evidence in this project. A controller using only a different app/cloud protocol needs separate implementation. |
| Other Keeson/Ergomotion Wi-Fi controllers advertising `_keeson._tcp` | **Candidate for investigation; unconfirmed** | Matching discovery is necessary but does not prove the command codes or motor mappings. |
| Bluetooth-only Keeson/Ergomotion, Richmat, Linak, Reverie, Okin or other controllers | **Not implemented** | Requires a different transport/protocol and hardware verification. Wi-Fi sharing by a phone does not turn a Bluetooth controller into this TCP controller. |
| RF-only remote, no local network controller | **Not implemented** | Would require additional hardware and a separate integration. |

“One side” is supported by configuration and automated accessory tests. It is not a separate physical-model compatibility claim.

## Why we do not list every Ergomotion or Beautyrest model

The [Beautyrest Black app’s official listing](https://apps.apple.com/us/app/beautyrest-black/id1441062223) describes Wi-Fi base control, but supplies no tested model matrix or TCP protocol specification. That listing establishes the app’s intended purpose, not this plugin’s compatibility.

The [current Black Luxury product page](https://www.beautyrest.com/products/black-luxury-base-bed-frame) lists features such as acoustic massage, multiple lighting settings and three memory presets. This plugin implements its original controller’s light toggle, two memory recalls and two massage-motor controls. A reused product name cannot establish feature or protocol equivalence.

Independent projects also distinguish transports: [smartbed-mqtt](https://github.com/richardhopton/smartbed-mqtt#readme) implements separate cloud, local Wi-Fi and Bluetooth paths. Its supported-device list must not be read as a supported-device list for this plugin.

Research checked 2026-11-22. These are investigation leads, not additional confirmed models.

## Request support or report a working model

Use the repository’s **Compatibility / new model** issue form. Include:

- Retail base brand/model, approximate year and one-piece vs independently controlled split setup.
- Controller **model/part number**, firmware version if readily available, and the exact manufacturer app name/link. A controller model is useful; its unique device ID is private.
- Whether the manufacturer app works, and whether the read-only discovery utility finds a compatible advertisement. Report Yes/No only; do not post its IDs or full TXT data.
- The feature requested and the corresponding physical-remote button.
- Plugin, Homebridge and Node versions, and only redacted errors.
- Whether you can help with supervised testing and report the result of each control individually.

If you share a controller/remote label photo, redact serial numbers, QR codes, MAC addresses, Wi-Fi credentials, addresses and other unique identifiers first. Do not move or lift a base to find a label if it is unsafe to do so. Do not post packet captures publicly; they can contain account or network information.

Reports are welcome, but **a request is not a commitment to implement support or a delivery date**. RebootDigital does not have every model available for testing. A change may remain unconfirmed or be declined when command meaning or safe stopping cannot be established.

## How support can expand

| Situation | Likely work | Required evidence |
| --- | --- | --- |
| Same protocol and functions, different retail name | Document another confirmed model; possibly no code change | Owner confirms each relevant control and reliable stop, including both sides if applicable. |
| Same transport, different features or command mappings | Add an explicit controller profile and capability selection; expose only supported controls | Manufacturer/protocol evidence, sanitized status fixtures, tests and supervised owner confirmation. Never guess a motor command. |
| Different status layout | Add a profile-specific parser rather than loosening validation for all controllers | Known message boundaries/checksums, sanitized fixtures, failure tests and owner confirmation. |
| Bluetooth, a different TCP protocol, or cloud-only controller | Implement an independent transport/profile, possibly in a separate plugin | Documented protocol or independently obtained evidence, reconnect/stop/error tests and access to a volunteer tester or hardware. Cloud support would change this project’s local-only scope. |

The existing client factory separates discovery/TCP behavior from Homebridge accessories, so the transport can be tested without hardware. It is not yet a multi-controller profile system. Extension is technically possible, but writing a fake-controller test does not establish that a physical base will behave correctly.

## Acceptance process

1. Gather read-only model and controller evidence first. Do not probe unknown motor codes.
2. Define the exact commands, response parser, supported features and release/stop behavior.
3. Add fake-controller tests for valid messages, malformed replies, disconnects, timeouts, concurrency and stop handling.
4. Make the change available as a clearly marked prerelease. The owner chooses a supervised testing session, with a clear bed and physical remote ready. Never run physical tests remotely without that arrangement.
5. Record per-feature results and remaining limitations. A community report is labeled as such, distinct from maintainer-tested hardware.
6. Publish confirmed support only to the scope of that evidence. Keep unknown features and variants unconfirmed.
