#!/usr/bin/env bash
# Cross-builds ardudeck-wfb-rx-win32-x64.exe (static, Windows 10+) from macOS or Linux.
# Usage: tools/wfb-rx/scripts/build-win-mingw.sh [work-dir]  ->  <work-dir>/dist/
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$SRC_DIR/build/win-mingw}"
mkdir -p "$WORK" && WORK="$(cd "$WORK" && pwd)"

LLVM_MINGW_TAG=20260922
LIBUSB_VER=1.0.30
LIBUSB_SHA=fea36f34f9156400209595e300840767ab1a385ede1dc7ee893015aea9c6dbaf
SODIUM_VER=1.0.22
SODIUM_SHA=adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349

case "$(uname -s)-$(uname -m)" in
  Darwin-*)
    LLVM_MINGW_HOST=macos-universal
    LLVM_MINGW_SHA=52e5f5a7b131021d0c39a37a38fa380a1da7885cd04bd61afd0cd4ecfb8bc1f3 ;;
  Linux-x86_64)
    LLVM_MINGW_HOST=ubuntu-22.04-x86_64
    LLVM_MINGW_SHA=bb7bb7654b33d5aa8712acb837c963b2e0c56352560c76105270a3268c665c21 ;;
  Linux-aarch64)
    LLVM_MINGW_HOST=ubuntu-22.04-aarch64
    LLVM_MINGW_SHA=07d21263c56bfe9a713db6fdb3f7434bf4c121a005e40397d3b4c0170fb06769 ;;
  *) echo "unsupported build host: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }

fetch() { # url file sha
  if [ ! -f "$WORK/$2" ] || [ "$(sha256 "$WORK/$2")" != "$3" ]; then
    curl -fsSL -o "$WORK/$2" "$1"
  fi
  local got; got="$(sha256 "$WORK/$2")"
  if [ "$got" != "$3" ]; then echo "checksum mismatch for $2: $got" >&2; exit 1; fi
}

LLVM_MINGW="llvm-mingw-$LLVM_MINGW_TAG-ucrt-$LLVM_MINGW_HOST"
fetch "https://github.com/mstorsjo/llvm-mingw/releases/download/$LLVM_MINGW_TAG/$LLVM_MINGW.tar.xz" "$LLVM_MINGW.tar.xz" "$LLVM_MINGW_SHA"
fetch "https://github.com/libusb/libusb/releases/download/v$LIBUSB_VER/libusb-$LIBUSB_VER.tar.bz2" "libusb-$LIBUSB_VER.tar.bz2" "$LIBUSB_SHA"
fetch "https://github.com/jedisct1/libsodium/releases/download/$SODIUM_VER-RELEASE/libsodium-$SODIUM_VER.tar.gz" "libsodium-$SODIUM_VER.tar.gz" "$SODIUM_SHA"

cd "$WORK"
[ -d "$LLVM_MINGW" ] || tar xf "$LLVM_MINGW.tar.xz"
TOOLCHAIN="$WORK/$LLVM_MINGW"
export PATH="$TOOLCHAIN/bin:$PATH"
HOST=x86_64-w64-mingw32
PREFIX="$WORK/prefix"

if [ ! -f "$PREFIX/lib/libusb-1.0.a" ]; then
  rm -rf "libusb-$LIBUSB_VER" && tar xf "libusb-$LIBUSB_VER.tar.bz2"
  (cd "libusb-$LIBUSB_VER" && ./configure --host=$HOST --prefix="$PREFIX" --enable-static --disable-shared CC=$HOST-clang \
    && make -j"$(getconf _NPROCESSORS_ONLN)" && make install)
fi
if [ ! -f "$PREFIX/lib/libsodium.a" ]; then
  rm -rf "libsodium-$SODIUM_VER" && tar xf "libsodium-$SODIUM_VER.tar.gz"
  (cd "libsodium-$SODIUM_VER" && ./configure --host=$HOST --prefix="$PREFIX" --enable-static --disable-shared CC=$HOST-clang \
    && make -j"$(getconf _NPROCESSORS_ONLN)" && make install)
fi

export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" PKG_CONFIG_PATH=
cmake -S "$SRC_DIR" -B "$WORK/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SYSTEM_NAME=Windows \
  -DCMAKE_SYSTEM_PROCESSOR=x86_64 \
  -DCMAKE_C_COMPILER=$HOST-clang \
  -DCMAKE_CXX_COMPILER=$HOST-clang++ \
  -DCMAKE_RC_COMPILER=$HOST-windres \
  -DCMAKE_FIND_ROOT_PATH="$PREFIX;$TOOLCHAIN/$HOST" \
  -DCMAKE_FIND_ROOT_PATH_MODE_PROGRAM=NEVER \
  -DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=ONLY \
  -DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=ONLY
cmake --build "$WORK/build" -j"$(getconf _NPROCESSORS_ONLN)"
llvm-strip "$WORK/build/bin/ardudeck-wfb-rx.exe"

mkdir -p "$WORK/dist"
ASSET=ardudeck-wfb-rx-win32-x64.exe
cp "$WORK/build/bin/ardudeck-wfb-rx.exe" "$WORK/dist/$ASSET"
(cd "$WORK/dist" && sha256 "$ASSET" > "$ASSET.sha256")
echo "built $WORK/dist/$ASSET"
