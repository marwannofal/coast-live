#!/usr/bin/env bash
# Run the built extension inside an isolated, headless GNOME Shell and report.
# It never touches your real session: settings, data and cache live in a temp dir.
# Usage: [WEATHER=rain] tests/gnome-headless.sh [THEME] [SECONDS] [SCREENSHOT.png]
# (It always uses fixed coordinates for Amman, so it never uses or sends your real location.)
set -uo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
theme=${1:-coast}; secs=${2:-20}; shot=${3:-}
zip=$root/dist/coast-live.shell-extension.zip
[ -f "$zip" ] || "$root/tools/build-gnome.sh" >/dev/null
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
export XDG_DATA_HOME=$tmp/data XDG_CONFIG_HOME=$tmp/config XDG_CACHE_HOME=$tmp/cache
export GSETTINGS_BACKEND=keyfile
uuid=coast-live@coastlive
mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions/$uuid" "$XDG_CONFIG_HOME/glib-2.0/settings"
unzip -q "$zip" -d "$XDG_DATA_HOME/gnome-shell/extensions/$uuid"
cat > "$XDG_CONFIG_HOME/glib-2.0/settings/keyfile" <<KEYS
[org/gnome/shell]
enabled-extensions=['$uuid']
disable-user-extensions=false
welcome-dialog-last-shown-version='99'

[org/gnome/shell/extensions/coast-live]
theme='$theme'
animation-speed='smooth'
weather-mode='${WEATHER:-off}'
manual-location=true
latitude=31.95
longitude=35.93
KEYS
inner=$tmp/inner.sh
cat > "$inner" <<INNER
gnome-shell --headless --wayland --no-x11 --wayland-display=coastlive-test --virtual-monitor 1280x720 > "$tmp/shell.log" 2>&1 &
pid=\$!
sleep $secs
if [ -n "$shot" ]; then
  gdbus call --session --dest org.gnome.Shell.Screenshot --object-path /org/gnome/Shell/Screenshot \
    --method org.gnome.Shell.Screenshot.Screenshot false false "$shot" > "$tmp/shot.log" 2>&1
fi
gnome-extensions info $uuid > "$tmp/info.txt" 2>&1
kill \$pid 2>/dev/null; wait \$pid 2>/dev/null
INNER
dbus-run-session -- bash "$inner"
echo "=== extension info"; cat "$tmp/info.txt" | grep -E "State|Enabled|Error" 
echo "=== shell log (Coast Live / errors)"; grep -iE "coast|JS ERROR|extension" "$tmp/shell.log" | grep -vE "GDM|calendar|geolocation" | head -30; grep -iE "Coast Live" -A6 "$tmp/info.txt" | head
[ -n "$shot" ] && { echo "=== screenshot"; cat "$tmp/shot.log"; }
echo "=== cache written:"; ls -la "$XDG_CACHE_HOME/coast-live" 2>/dev/null
echo "=== background keys (isolated keyfile):"; grep -A3 'desktop/background' "$XDG_CONFIG_HOME/glib-2.0/settings/keyfile" 2>/dev/null
