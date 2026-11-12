#!/usr/bin/env bash
# Build the Plasma 6 wallpaper package from the repository sources.
# Usage: tools/build-kde.sh [OUTPUT_DIR]     (default: dist/)
# Result: OUTPUT_DIR/kde/org.coastlive.wallpaper/  and  OUTPUT_DIR/coast-live.plasma-wallpaper.zip
# Install:  kpackagetool6 -t Plasma/Wallpaper -i dist/kde/org.coastlive.wallpaper
# Needs: node, zip
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=${1:-$root/dist}
pkg=$out/kde/org.coastlive.wallpaper
rm -rf "$pkg"
mkdir -p "$pkg"
cp -r "$root"/kde/. "$pkg/"

# The shared core, as QML-importable ES modules (.mjs).
for f in "$root"/core/*.js; do
    name=$(basename "$f" .js)
    sed -E "s#from '\./([a-z-]+)\.js'#from './\1.mjs'#" "$f" > "$pkg/contents/code/$name.mjs"
done

# Data the core normally reads from files, embedded as modules (QML cannot read local files).
node --input-type=module - "$root" "$pkg/contents/code" <<'JS'
import fs from 'node:fs';
const [root, dest] = process.argv.slice(2);
const text = file => fs.readFileSync(`${root}/assets/data/${file}`, 'utf8');
fs.writeFileSync(`${dest}/zone-data.mjs`,
    `export const ZONE_TAB = ${JSON.stringify(text('zone.tab'))};\n`
    + `export const ZONE_LINKS = ${JSON.stringify(text('zone-links.txt'))};\n`);
const layout = JSON.parse(fs.readFileSync(`${root}/assets/themes/layout.json`, 'utf8'));
fs.writeFileSync(`${dest}/layout.mjs`, `export const layout = ${JSON.stringify(layout)};\n`);
JS

# Terrain art (the lit stills are only used by the GNOME background and are left out).
for theme in dunes plateau oasis; do
    mkdir -p "$pkg/contents/themes/$theme"
    cp "$root"/assets/themes/$theme/{ground,palm}-*.png "$pkg/contents/themes/$theme/" 2>/dev/null || \
        cp "$root"/assets/themes/$theme/ground-*.png "$pkg/contents/themes/$theme/"
done
cp "$root/COPYING" "$pkg/"
(cd "$out/kde" && rm -f "$out/coast-live.plasma-wallpaper.zip" && zip -qr -X "$out/coast-live.plasma-wallpaper.zip" org.coastlive.wallpaper)
ls -l "$out/coast-live.plasma-wallpaper.zip"
