# Limon Calculator

Limon Calculator is a standalone calculator built with Tauri 2, Vite, and Math.js. The shared interface can be packaged for Windows, macOS, Linux, Android, and iOS. Android releases need the Android SDK; iOS builds must be made on macOS with Xcode.

## Development

```powershell
npm install
npm test
npm run tauri -- dev
```

Build the frontend with `npm run build` or create a desktop installer with `npm run tauri -- build`.

Normal mode includes a full-height keypad, locale-aware decimal separators, percentage calculations (`32% + 3 = 3,32`; `200 + 10% = 220`), and local history. Advanced mode places a 4×4 scientific panel beside the keypad, with a second-function layer, DEG/RAD/GRAD angle modes, Ans, and MC/MR/M+/M− memory controls.

Professional mode starts with a persistent, multi-line math workspace. Each line is evaluated independently; assignments support Latin and Cyrillic names, comments start with `#`, and function arguments are separated by semicolons. It includes a safe recursive-descent expression parser, documented function autocomplete, DEG/RAD/GRAD angle modes, variable insertion, copy actions, and CSV export. Workspace text is stored in this device's local storage.

The professional programmer tool supports 8/16/32/64-bit unsigned and signed integers with BigInt arithmetic, HEX/DEC/OCT/BIN output, a clickable bit grid, ranges, and AND/OR/XOR/NOT/left-shift/right-shift operations. Values can be inserted into the workspace.

The finance tool supports annuity and differential loan schedules, VAT, compound interest, markup/margin calculations, CSV payment schedules, and workspace-formula insertion. Financial amounts can be labeled in RUB, USD, EUR, GBP, CNY, KZT, or JPY; this selection is saved locally and does not convert values using exchange rates. The separate converter handles length, mass, and temperature.

The account drawer uses the same Supabase Auth project as Limon Hub for email/password sign-in, registration, and sign-out. Sessions persist locally in the calculator; cross-app data synchronization is not enabled yet.

The account drawer's Settings section lets you choose Russian or English, a light or dark theme, and a standard, translucent, or liquid-glass appearance. Preferences are saved locally on the device. On Windows, the translucent styles use the native Acrylic window material; on macOS, they use native vibrancy, with Liquid Glass available on macOS 26 and newer. Other platforms and browser previews use a CSS glass fallback.

Inter and JetBrains Mono are bundled locally through Fontsource, so the interface does not request fonts from the network.

Initialize a mobile project with `npm run tauri -- android init` or `npm run tauri -- ios init`, then use the corresponding `android` or `ios` Tauri commands to run and build it.

## Publish a Windows release

The `Limon-Digital-Technologies/LimonDT-Calculator` GitHub Actions workflow builds and publishes a Windows MSI and its SHA-256 checksum when a `v*` tag is pushed. Keep the versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` in sync, then push the matching version tag:

```powershell
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
git push origin main
git tag "v$version"
git push origin "v$version"
```

The MSI is published as `Limon-Calculator-windows-x64.msi` for the Hub to download.
