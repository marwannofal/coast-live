#!/usr/bin/env bash
# Measure gnome-shell CPU and memory with a given extension zip (or none), in an isolated headless
# session (never touches your desktop). Usage: tests/gnome-perf.sh ZIP|none [THEME] [FPS_MODE]
set -uo pipefail
zip=${1:-none}; theme=${2:-coast}; mode=${3:-balanced}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
export XDG_DATA_HOME=$tmp/data XDG_CONFIG_HOME=$tmp/config XDG_CACHE_HOME=$tmp/cache GSETTINGS_BACKEND=keyfile
uuid=coast-live@coastlive
mkdir -p "$XDG_CONFIG_HOME/glib-2.0/settings"
enabled="[]"
if [ "$zip" != none ]; then
    mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions/$uuid"; unzip -q "$zip" -d "$XDG_DATA_HOME/gnome-shell/extensions/$uuid"
    enabled="['$uuid']"
fi
cat > "$XDG_CONFIG_HOME/glib-2.0/settings/keyfile" <<KEYS
[org/gnome/shell]
enabled-extensions=$enabled
disable-user-extensions=false
welcome-dialog-last-shown-version='99'

[org/gnome/shell/extensions/coast-live]
theme='$theme'
animation-speed='$mode'
KEYS
cat > "$tmp/inner.sh" <<INNER
gnome-shell --headless --wayland --no-x11 --wayland-display=coastlive-perf --virtual-monitor 1280x720 > "$tmp/shell.log" 2>&1 &
sleep 14
pid=\$(pgrep -n -x gnome-shell); hz=\$(getconf CLK_TCK)
t0=\$(awk '{print \$14+\$15}' /proc/\$pid/stat); sleep 12; t1=\$(awk '{print \$14+\$15}' /proc/\$pid/stat)
echo "cpu=\$(( (t1-t0)*1000/hz/12 )) rss=\$(awk '/VmRSS/{print int(\$2/1024)}' /proc/\$pid/status)" > "$tmp/result"
kill \$pid 2>/dev/null; wait 2>/dev/null
INNER
dbus-run-session -- bash "$tmp/inner.sh" >/dev/null 2>&1
read -r cpu rss < <(sed 's/cpu=//; s/rss=//' "$tmp/result" 2>/dev/null)
printf "%-34s CPU %s.%s%% of one core   gnome-shell memory %s MB\n" "$(basename "$zip") $theme/$mode" $((cpu/10)) $((cpu%10)) "$rss"
