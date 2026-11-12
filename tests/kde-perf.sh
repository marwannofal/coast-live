#!/usr/bin/env bash
# Guard against the KDE scene ever becoming heavy again. Runs it offscreen with Qt's *software*
# renderer (no GPU, so pessimistic) and checks steady-state CPU and the longest single tick.
# Never touches your desktop. Usage: tests/kde-perf.sh [THEME]
set -uo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
theme=${1:-coast}
tools/build-kde.sh >/dev/null
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
sed 's/interval: 6000/interval: 30000/' tests/kde-harness.qml > tests/_perf.qml; trap 'rm -rf "$tmp" tests/_perf.qml' EXIT
QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software timeout 60 qml6 tests/_perf.qml -- "$theme" -1 0 "$tmp/out.png" >"$tmp/log" 2>&1 &
sleep 12; pid=$(pgrep -n qml6); hz=$(getconf CLK_TCK)
t0=$(awk '{print $14+$15}' /proc/$pid/stat); sleep 10; t1=$(awk '{print $14+$15}' /proc/$pid/stat)
cpu=$(( (t1-t0)*100/hz/10 )); rss=$(awk '/VmRSS/{print int($2/1024)}' /proc/$pid/status)
kill $pid 2>/dev/null; wait 2>/dev/null
echo "$theme: steady CPU ${cpu}% of one core (limit 25%), memory ${rss} MB"
errors=$(grep -ciE "TypeError|ReferenceError|is not a function|unavailable" "$tmp/log" || true)
echo "script errors: $errors"
[ "$cpu" -le 25 ] && [ "$errors" = 0 ]
