# remotepad

Low-latency remote input server and layout editor.

The server is Rust: `axum` for HTTP/static/layout APIs, binary UDP for the hot
input path, and `enigo` for host keyboard/mouse injection. The web layout
editor is Solid + Tailwind + Vite and is only an editor; runtime input clients
should use the native UDP protocol.

## Goals

- UDP-first input path for rhythm-game and remote-play latency work.
- Stateful frames with sequence numbers, so packet loss does not leave held
  keys stuck.
- 10+ simultaneous key states in a single datagram.
- JSON layout save/load through `GET /api/layouts/:name` and
  `PUT /api/layouts/:name`.
- iOS client foundation in `ios/RemotePadClient`.

The local server decode/dispatch target is sub-1ms. End-to-end iOS/Wi-Fi/input
injection latency depends on hardware, OS scheduling, network contention, and
the selected backend, so measure on the target device before relying on a
specific latency number.

## Prerequisites

- Rust 1.88 or newer.
- Node.js 22 or newer for the layout editor build.
- Swift toolchain for the iOS package tests.
- OS input permissions when running `--backend enigo`.

## Install

```bash
git clone https://github.com/eunhhu/remotepad.git
cd remotepad
npm ci
npm run build
```

## Run

```bash
cargo run --bin remotepad -- \
  --backend noop \
  --http-addr 0.0.0.0:3000 \
  --udp-addr 0.0.0.0:3001 \
  --layout-dir layouts \
  --public-dir web/dist
```

Use `--backend enigo` only when you want real host input injection. Keep
`--backend noop` for protocol QA, layout work, and latency measurement without
sending real key events.

Open `http://<host-ip>:3000/` for the layout editor after `npm run build`.

## Develop

Run the Rust server:

```bash
cargo run --bin remotepad -- --backend noop
```

Run the Vite editor with API proxying to the Rust server:

```bash
npm run dev
```

Then open `http://localhost:5173/`.

## Layout JSON

Layouts are stored under `--layout-dir` as `<name>.json`. The editor reads and
writes `default` by default, which maps to `layouts/default.json`.

```json
{
  "canvasSize": {
    "width": "820px",
    "height": "420px"
  },
  "controls": [
    {
      "type": "Button",
      "left": "32px",
      "top": "272px",
      "width": "88px",
      "height": "88px",
      "borderRadius": "18px",
      "transform": "",
      "key": "KeyZ"
    }
  ]
}
```

Supported control types:

- `Button`
- `Joystick`
- `MouseZone`

The editor also supports local JSON import/export in the browser.

## UDP Protocol

The binary UDP protocol lives in `src/protocol.rs`; `remotepad-qa` can send QA
frames to a running server.

```bash
cargo run --bin remotepad-qa -- \
  --addr 127.0.0.1:3001 \
  --sequence 1 \
  --down KeyZ \
  --down KeyX
```

## Test

```bash
npm run typecheck
npm run build
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
swift test --package-path ios/RemotePadClient
```

## Project Layout

```text
remotepad/
├─ src/                 Rust server, UDP protocol, input backend
├─ src/bin/             QA sender binary
├─ tests/               Rust integration tests
├─ web/                 Solid + Tailwind + Vite layout editor
├─ ios/RemotePadClient/ Swift UDP client package
├─ Cargo.toml
├─ package.json
└─ vite.config.ts
```

## Security

The layout API and UDP input socket are unauthenticated LAN tools. Do not run
`remotepad` on an untrusted network. Bind to `127.0.0.1` or firewall the ports
when you need a smaller surface.

## License

`remotepad` is released under the [ISC License](LICENSE).
