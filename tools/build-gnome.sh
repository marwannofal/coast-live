#!/usr/bin/env bash
# Build the GNOME Shell extension zip from the repository sources.
# Usage: tools/build-gnome.sh [OUTPUT_DIR]      (default: dist/)
# Needs: glib-compile-schemas, zip
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=${1:-$root/dist}
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

mkdir -p "$out" "$stage/core" "$stage/data" "$stage/themes" "$stage/schemas"
cp "$root"/gnome/{metadata.json,extension.js,prefs.js,background-sync.js,location.js} "$stage/"
cp "$root"/core/*.js "$stage/core/"
cp "$root"/assets/data/* "$stage/data/"
cp -r "$root"/assets/themes/. "$stage/themes/"
cp "$root"/gnome/schemas/*.xml "$stage/schemas/"
glib-compile-schemas --strict "$stage/schemas"
cp "$root/COPYING" "$root/docs/preview.jpg" "$stage/"

rm -f "$out/coast-live.shell-extension.zip"
(cd "$stage" && zip -qr -X "$out/coast-live.shell-extension.zip" .)
ls -l "$out/coast-live.shell-extension.zip"
