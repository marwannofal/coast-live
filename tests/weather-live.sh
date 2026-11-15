#!/usr/bin/env bash
# Optional network check of the live weather path: fetches the real current weather for Amman (fixed public
# coordinates, nothing about you) with the same code the GNOME extension uses. Not part of run-all (needs internet).
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$root/dist/coast-live.shell-extension.zip" ] || "$root/tools/build-gnome.sh" >/dev/null
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
unzip -q "$root/dist/coast-live.shell-extension.zip" -d "$tmp"
cat > "$tmp/check.js" <<'JS'
import GLib from 'gi://GLib';
import { WeatherFeed } from './weather.js';
const loop = GLib.MainLoop.new(null, false);
const feed = new WeatherFeed(() => [31.95, 35.93], () => {
    print('live weather for Amman: ' + JSON.stringify(feed.weather));
    feed.stop();
    loop.quit();
});
feed.start();
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 20, () => {
    print('no answer within 20 s (offline?)');
    feed.stop();
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
loop.run();
JS
(cd "$tmp" && gjs -m check.js)
