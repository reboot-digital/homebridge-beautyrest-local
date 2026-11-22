# Contributing

Bug reports, compatibility reports and pull requests are welcome. Use the repository's issue forms and read the [compatibility guide](docs/COMPATIBILITY.md) before proposing support for another base.

## Local checks

```sh
npm ci --ignore-scripts
npm run check
npm test
npm pack --dry-run
```

The automated suite uses fake discovery and loopback TCP controllers. It must never discover or move a real bed. CI also runs against Node 22, 24 and 26 with Homebridge 2, plus Node 20 with Homebridge 1.8.

## Changes to controls

- Preserve controller-ID/command accessory UUIDs so upgrades retain existing Apple Home accessories.
- Keep bounded manual movement and RELEASE recovery. Never replay movement or timer/light toggle commands after uncertain delivery.
- Test malformed replies, disconnects, deadlines, concurrency and resource cleanup for transport changes.
- Do not guess motor codes or infer compatibility from a matching brand or remote.
- Arrange any physical testing with the owner in advance, one command at a time, with the bed clear and the physical remote available. Record what was tested and what remains unknown.

## Privacy

Do not commit Homebridge storage, configuration, pairing records, tokens, controller IDs or packet captures. Use placeholder IDs and sanitized fixtures. Redact identifying details from issue attachments.

## Releases

Run the checks, review the package contents, update the changelog and publish matching npm and GitHub releases. Documentation and test-only changes do not require reinstalling the plugin. Only display a Homebridge verification badge after the Homebridge team approves the plugin.
