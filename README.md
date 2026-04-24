<div align="center">

# remotepad

**Turn your phone into a keypad, gamepad, or air-mouse for your PC.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)

</div>

---

## Overview

`remotepad` is a small Node.js server that exposes a touch UI to any phone on
the same Wi-Fi network and forwards touches, joystick events, and gyroscope
motion back to your PC as real keyboard/mouse input. It ships with three
clients out of the box:

| Page | URL | What it is |
|---|---|---|
| **Keypad** | `/` | Fully configurable touch layout built from `public/save.json`. Buttons act as held keys, joysticks move the mouse, "mouse zones" do deltas + tap-to-click. |
| **Mouse** | `/mouse` | Turns the phone into an air-mouse using `deviceorientation`. Left / right buttons press & release real mouse buttons; the switch arms/disarms motion. |
| **Editor** | `/editor` | Drag-and-drop editor that lets you place buttons, joysticks and mouse zones on a canvas and live-push the layout to the running Keypad page. |

Motion is translated to real HID events on the host PC via
[`@nut-tree-fork/nut-js`](https://github.com/nut-tree/nut.js) (keyboard
presses, mouse buttons, mouse scroll) and
[`robotjs`](https://github.com/octalmage/robotjs) (sub-pixel mouse movement
with zero-delay tuning).

## Features

- **Works on any modern smartphone** — no app install, just open the URL in a
  browser.
- **Keypad, joysticks, mouse zones** — press keyboard keys, move the mouse
  with a virtual stick, or scrub a touch area with tap-to-click.
- **Air-mouse mode** using gyroscope / device orientation.
- **Visual layout editor** with undo/redo, import/export, zoom, and live
  apply over HTTP.
- **Preset layouts** included out of the box (`public/keyboard.json`,
  `public/mkeyboard.json`, `public/pump.json`).
- **Configurable sensitivity and port** via environment variables.
- Clean `Ctrl+C` shutdown.

## Platform support

- **Server** — runs on Windows, macOS, and Linux. `robotjs` and
  `@nut-tree-fork/nut-js` are native add-ons; on Linux you will need
  `libxtst-dev` and an X11 session for global input injection. On Wayland the
  host-side input injection may silently drop events.
- **Client** — any mobile browser that supports ES2019, Touch events,
  `DeviceOrientationEvent`, and `navigator.vibrate`. iOS 13+ requires the
  user to grant motion/orientation permission when using `/mouse` or
  `/game`.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer and `npm`
- C/C++ toolchain for building `robotjs` (MSVC Build Tools on Windows, Xcode
  Command Line Tools on macOS, `build-essential` + `libxtst-dev` on Linux)
- A phone on the **same LAN** as the PC

### Install

```bash
git clone https://github.com/eunhhu/remotepad.git
cd remotepad
npm install
```

### Run the server

```bash
npm start
```

By default the server listens on every interface at port `3000`. Open the
printed IP on your phone, e.g. `http://192.168.1.42:3000/`.

Configuration is done entirely via environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | TCP port for the HTTP / Socket.IO server. |
| `REMOTEPAD_SENSITIVITY` | `30` | Scale factor applied to gyro-based mouse motion (see `src/index.ts`). |

```bash
PORT=5000 REMOTEPAD_SENSITIVITY=60 npm start
```

### Develop

```bash
npm run dev          # nodemon + ts-node
npm run dev:watch    # nodemon + tsc --watch in parallel
npm run typecheck    # no-emit type check only
```

### Build

```bash
npm run build        # compile TS into ./dist
npm run build:pkg    # compile + bundle a single binary per platform via pkg
```

The `pkg` build targets `node18-win-x64`, `node18-linux-x64`, and
`node18-macos-x64`. Note that `robotjs` / `nut-js` native modules must be
rebuilt per host target — use the plain `npm run build` plus a `node
dist/index.js` launcher for the most reliable result.

## Using the clients

### Keypad (`/`)

The Keypad page loads `public/save.json` at startup and builds a
touch-friendly layout. The server overwrites that file when the Editor calls
"apply", so the Keypad reloads to pick up the new layout. Supported controls:

- **Button** — Emits `buttonPress` / `buttonRelease` with a DOM `key` code
  (e.g. `KeyA`, `Digit1`, `ArrowUp`) that maps to a real keypress through
  `src/keymap.ts`. Unknown keys are silently ignored.
- **Joystick** — Emits `joystickMove` with an angle and distance. The server
  translates it to `mouse.setPosition(...)` deltas.
- **MouseZone** — A touch area. Dragging emits `mouseZoneMove` deltas; a
  short tap emits `mouseZoneClick` (left button).

Tap **Full Screen** to hide the browser chrome.

### Mouse (`/mouse`)

Three regions: red (left-click), blue (right-click), grey (switch). Tap the
switch to arm/disarm motion tracking, then tilt the phone to move the cursor.

### Editor (`/editor`)

Keyboard shortcuts:

| Shortcut | Action |
|---|---|
| `Ctrl` + `Z` / `Ctrl` + `Shift` + `Z` | Undo / Redo |
| `Ctrl` + `S` | Export the current layout as a `.json` file |
| `Ctrl` + `O` | Open a saved `.json` layout |
| `Ctrl` + `D` | Duplicate the selected control |
| `Ctrl` + `Enter` | **Apply** — push the current layout to the running Keypad |
| `Delete` | Remove the selected control |
| Mouse wheel | Zoom in / out |

### Included layout presets

| File | Use case |
|---|---|
| `public/save.json` | The active layout the Keypad serves at `/`. |
| `public/keyboard.json` | Desktop-style QWERTY layout. |
| `public/mkeyboard.json` | Compact mobile keyboard layout. |
| `public/pump.json` | Arcade-style button grid. |

To activate a preset, open it in the Editor (`Ctrl` + `O`) and press
`Ctrl` + `Enter` to apply.

## Security notes

The `/api/update` endpoint writes `public/save.json` without any
authentication — **do not run `remotepad` on an untrusted network**. It is
intended for a LAN between your PC and your own phone. Bind to `127.0.0.1`
via a reverse proxy or firewall rule if you need a narrower surface.

## Project layout

```
remotepad/
├─ src/
│  ├─ index.ts      # Express + Socket.IO server and input forwarding
│  └─ keymap.ts     # DOM key code → nut-js Key mapping
├─ public/
│  ├─ index.html    # Keypad (the default page)
│  ├─ mouse.html    # Air-mouse using deviceorientation
│  ├─ editor.html   # Drag-and-drop layout editor
│  ├─ game.html     # Experimental AR maze demo
│  ├─ save.json     # Active layout (rewritten by the editor)
│  ├─ keyboard.json, mkeyboard.json, pump.json   # Included presets
│  └─ ...
├─ package.json
└─ tsconfig.json
```

## Contributing

Issues and pull requests are welcome. Before opening a PR, please run
`npm run typecheck` and confirm the server still starts with `npm start`.

## License

`remotepad` is released under the [ISC License](LICENSE).
