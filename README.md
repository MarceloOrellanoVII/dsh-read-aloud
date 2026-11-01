## Features

- **"Read result"** button in the composer dock — reads the latest assistant message; while speaking it becomes **Stop**.
- **Speaker icon on every assistant message** — read any single message on demand.
- **⚙ Voice & speed settings** (gear next to the button) — pick any installed Windows voice (offline voices are marked), set speed from 0.75× to 2×. Your choice is remembered on the machine.
- **English and Chinese** UI — follows the app's current language.
- **Theme-aware** — adapts to light/dark themes automatically.
- **Contribution section** in the settings panel (PayPal button + QR code).

## Install

1. Copy this folder to your machine (e.g. `C:\plugins\dsh-read-aloud`).
2. In DeepSeek Harness open the **Plugins** panel (sidebar → Global panels → *Plugins*).
3. Click **Add plugin**, paste the folder path, then **Install** → **Enable now**.

Notes:

- The **desktop** profile is managed exclusively by the Electron app — the `dsh plugin` CLI cannot add to it, so use the GUI Plugins page (this is by design).
- For other profiles: `dsh plugin --profile <name> add <folder>`.
- Requires Windows for the built-in voices. The UI itself works wherever the DSH Web GUI runs; on non-Windows systems the OS's Web Speech voices are used instead.

## How it works

- Speech is produced locally by `speechSynthesis` inside the Electron renderer — nothing leaves your machine.
- Windows loads its voice list asynchronously; on a cold start the plugin waits up to 5 s for the voices before speaking.
- Messages are located through stable structural markers in the conversation DOM. If DeepSeek Harness changes its internal markup, the plugin may need a small update — that's the main maintenance dependency.
- Per browser policy, speech synthesis requires a real user click (automated clicks without user activation are rejected by the engine).

## Support

If this plugin is useful to you, a small contribution keeps it maintained:

- **[Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=YHFEX4KPGJ9R2)**

| Scan to donate |
| :--: |
| ![PayPal QR code](paypal-qr.png) |

## Package layout

| File | Purpose |
| --- | --- |
| `package.json` | Bundle manifest (`dsh.bundle.patch` + `dsh.client`) |
| `cordis.patch.yml` | Bundle registration |
| `index.js` | Host entry (no-op; this plugin is client-only) |
| `client.js` | All client logic: dock button, voice/speed popover, per-message icons, donation panel |
| `locale/en.json`, `locale/zh.json` | Bundle meta (name/description) per language |
| `icon.svg` | Plugin icon |
| `paypal-qr.png` | Donation QR code (also embedded in `client.js` as base64) |

> If you rename the package, keep the `id` at the top of `client.js` in sync with the `name` in `package.json`.

## Roadmap / ideas

- Pitch control, per-language default voice.
- Optional streaming read of still-generating messages.
- Contribution: pull requests welcome.
