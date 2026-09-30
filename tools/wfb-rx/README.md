# ardudeck-wfb-rx

Headless wfb-ng receiver sidecar for ArduDeck's "plug the dongle into this
computer" camera path (OpenIPC / RunCam WiFiLink).

Claims an RTL8812AU-family adapter over libusb in userspace (no kernel
driver; on Windows after a one-time WinUSB switch, see below), receives the wfb-ng broadcast, decrypts (gs.key,
libsodium), FEC-decodes (zfex) and emits the video as RTP on UDP - where
ArduDeck's media engine (`wfbng` camera source, dongle mode) ingests it.

```
ardudeck-wfb-rx --key gs.key --channel 161 --bandwidth 20 \
                --output udp://127.0.0.1:5600 [--host <ip>] [--device vid:pid] [--list]
```

`--host <ip>` forwards the decoded video to another machine instead of
localhost - e.g. run the receiver on a PC that can power the dongle and
point `--host` at a Mac running ArduDeck (feed set to Network mode). Both
machines must share a network.

## Building and releasing

- macOS / Linux: `cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build`
  (deps: `brew install libusb libsodium pkg-config`, or
  `libusb-1.0-0-dev libudev-dev libsodium-dev libpcap-dev`). libusb and
  libsodium are linked statically so the binary runs without them installed.
- Windows x64: `scripts/build-win-mingw.sh` cross-builds a static
  `ardudeck-wfb-rx-win32-x64.exe` from macOS or Linux (llvm-mingw, pinned and
  checksummed). CMake still accepts the MSVC + vcpkg setup from Aviateur
  (`x64-windows-static`), but CI does not exercise it.
- Release: pushing a `wfb-rx-v*` tag runs `.github/workflows/build-wfb-rx.yml`,
  which attaches `ardudeck-wfb-rx-<platform>-<arch>[.exe]` to a pre-release.
  The app downloads from the tag pinned in
  `apps/desktop/src/main/media/wfb-rx-release.ts`.

On Windows the dongle must be switched to the WinUSB driver once with
[Zadig](https://zadig.akeo.ie/) (Options > List All Devices, pick the Realtek
adapter, install WinUSB); Windows otherwise binds its own Realtek driver and
libusb cannot open the device.

ArduDeck spawns and supervises this binary via
`apps/desktop/src/main/media/wfbng-receiver.ts`; the CLI contract lives in
`wfbng-dongle.ts`.

## Provenance and license

`src/wifi/` and `3rd/devourer/` are vendored unmodified from
[OpenIPC Aviateur](https://github.com/OpenIPC/aviateur)
(commit `2a5a4f241a2f3f13ab170876547f340a3a3d4e50`); `src/gui_interface.h`
is ArduDeck's headless shim replacing Aviateur's GUI singleton, and
`src/main.cpp` is the CLI entry point. This tool is therefore distributed
under the GPL (see LICENSE) as a separate executable; ArduDeck itself
launches it as an independent process and does not link against it.
