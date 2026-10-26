# RemotePad

A low-latency remote input pad: a Rust server receives key states over a binary UDP protocol and injects them into the host with `enigo`, a Solid/Tailwind web app edits the on-screen control layout, and an iOS app renders that layout as a touch keypad.

[![CI](https://github.com/eunhhu/remotepad/actions/workflows/ci.yml/badge.svg)](https://github.com/eunhhu/remotepad/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

**Status:** Maintained — v0.2.4; keyboard input over UDP is implemented and tested. `Joystick` and `MouseZone` controls exist in the layout schema and editor, but the server and clients only dispatch key events today.

## Features

- Stateful UDP frames with sequence numbers and up to 32 simultaneous keys per datagram, so packet loss never leaves a key stuck
- Two frame kinds: `KeyEvent` (single press/release) and `KeyState` (full set of held keys)
- `enigo` backend for real keyboard injection, `noop` backend for protocol QA and latency measurement
- Layout JSON API: `GET`/`PUT /api/layouts/{name}`, `POST /api/clients/connect`, `GET /api/stats`, `GET /healthz`
- Web layout editor (Solid + Tailwind + Vite): drag/resize controls, inspector, keyboard shortcuts, browser-side JSON import/export
- `remotepad-qa` binary that sends test frames to a running server
- iOS: `RemotePadClient` Swift package (protocol, key-code mapping, HTTP + UDP senders, unit tests) and `RemotePadApp` SwiftUI wrapper with lock mode and haptics
- GitHub Actions: fmt/clippy/test/typecheck CI; `v*` tags build Linux/macOS/Windows binaries and an unsigned iOS IPA

## How it works

- `src/protocol.rs` defines the wire format (magic byte `0x52`, versioned header, sequence, client timestamp, frame kind, key list) and encode/decode with tests in `tests/protocol.rs`.
- `src/udp.rs` reads datagrams on the UDP socket, validates sequence order, and forwards key changes to `src/input.rs`, which diffs against the current held set and calls the backend (`enigo` or `noop`); `src/keymap.rs` maps DOM `KeyboardEvent.code` names to Windows scan codes used on the wire.
- `src/http.rs` (axum) serves the built editor from `--public-dir`, exposes the layout and stats API, and logs client connects; `src/layout.rs` validates layout JSON; `src/paths.rs` resolves the layout directory relative to the executable or cwd; `src/stats.rs` tracks counters shown by `/api/stats`.
- `web/src/` is the editor: `App.tsx`, `useEditor.ts`, `geometry.ts` (tests in `geometry.test.ts`), `components/` (CanvasView, Inspector, Toolbar, TopBar), `api.ts` for the layout endpoints.
- The iOS app calls `POST /api/clients/connect`, fetches `GET /api/layouts/default`, and then streams frames over UDP.

## Tech stack

- Server: Rust 2024 (MSRV 1.88), tokio, axum 0.8, tower-http, enigo 0.6, clap, serde, tracing
- Editor: Solid 1.9, Tailwind 3, Vite 6, TypeScript 5.7, Zod, Vitest, Playwright (dev dependency)
- iOS: Swift Package (`ios/RemotePadClient`), XcodeGen-generated app (`ios/RemotePadApp`)
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

## Getting started

### Requirements

- Rust 1.88+ (pinned in `rust-toolchain.toml`)
- Node.js 22+ for the editor
- Swift toolchain / Xcode + XcodeGen for the iOS pieces
- OS input permissions for the `enigo` backend (Accessibility on macOS)

### Install

```bash
git clone https://github.com/eunhhu/remotepad.git
cd remotepad
npm ci
npm run build           # editor → web/dist
cargo build --release
```

Pre-built binaries and an unsigned IPA are attached to [GitHub Releases](https://github.com/eunhhu/remotepad/releases).

### Run

```bash
cargo run --bin remotepad -- --backend enigo --layout-dir layouts --public-dir web/dist
cargo run --bin remotepad -- --backend enigo --port 3001      # HTTP and UDP on the same port number
cargo run --bin remotepad -- --backend enigo --load save.json # edit/save a specific layout file
cargo run --bin remotepad -- --backend noop                   # QA without injecting input
```

Defaults: HTTP editor on `3000`, UDP input on `3001`. Open `http://<host-ip>:3000/` for the editor (or `npm run dev` for the Vite dev server on `5173` with API proxying).

Send QA frames:

```bash
cargo run --bin remotepad-qa -- --target 127.0.0.1:3001 --key KeyZ --key KeyX
```

Tests:

```bash
npm run typecheck && npm test && npm run build
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
swift test --package-path ios/RemotePadClient
xcodegen generate --spec ios/RemotePadApp/project.yml
xcodebuild -project ios/RemotePadApp/RemotePad.xcodeproj -target RemotePad -configuration Debug -sdk iphonesimulator build
```

## Layout JSON

Stored under `--layout-dir` as `<name>.json`; the editor uses `default` → `layouts/default.json`.

```json
{
  "canvasSize": { "width": "820px", "height": "420px" },
  "controls": [
    { "type": "Button", "left": "32px", "top": "272px", "width": "88px", "height": "88px",
      "borderRadius": "18px", "transform": "", "key": "KeyZ" }
  ]
}
```

Control types: `Button`, `Joystick`, `MouseZone`.

## Project structure

```text
src/            server: main.rs, http.rs, udp.rs, protocol.rs, input.rs, keymap.rs, layout.rs, paths.rs, stats.rs
src/bin/        remotepad-qa.rs
tests/          protocol, keymap, stats integration tests
web/            Solid + Tailwind + Vite layout editor
ios/RemotePadClient/   Swift client package with tests
ios/RemotePadApp/      SwiftUI app (XcodeGen project.yml, ExportOptions.plist)
.github/workflows/     ci.yml, release.yml
```

## Configuration

Flags: `--port`, `--http-addr`, `--udp-addr`, `--layout-dir` (default `layouts`), `--load`, `--public-dir` (default `web/dist`), `--backend enigo|noop`. Logging level via `RUST_LOG`.

## Security

The layout API and UDP socket are unauthenticated LAN tools. Do not expose them on untrusted networks; bind to `127.0.0.1` or firewall the ports when in doubt.

## History

The repository started in 2024 as an Express/TypeScript web keypad with HTML editor pages (`public/editor.html`, `mouse.html`, `game.html`, gyro experiments); that code was replaced by the Rust server and Solid editor in the `feat: replace legacy web UI with UDP layout editor` commit.

## License

[ISC](LICENSE).
