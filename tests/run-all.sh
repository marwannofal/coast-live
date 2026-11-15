#!/usr/bin/env bash
# Everything that can be verified on a desktop. Needs gjs, node, java, qml6, python3 (numpy, PIL).
# GNOME Shell itself is exercised headless in an isolated session (no effect on your desktop).
set -uo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
status=0
step() { printf '\n=== %s\n' "$1"; shift; "$@" || status=1; }

step "core loads (node)"                         node tests/core-loads.mjs
step "time-of-day setting (fixed time)"          node tests/fixed-time.mjs
step "weather codes and parsing"                 node tests/weather.mjs
step "core runs under GJS and is fast enough"    gjs -m tests/gjs-smoke.js "$(mktemp -d)"
step "Java port == JavaScript core"              bash -c '
    tmp=$(mktemp -d); node tests/android-golden.mjs "$tmp/golden" >/dev/null
    node tools/gen-android-layout.mjs > "$tmp/Layout.java"; mkdir "$tmp/jvm"
    javac --release 17 -d "$tmp/jvm" android/core/org/coastlive/core/*.java "$tmp/Layout.java" android/test/org/coastlive/test/*.java
    java -cp "$tmp/jvm" org.coastlive.test.GoldenTest "$tmp/golden" "$PWD"'
step "GNOME, QML and Java renderers agree"       tests/compare-renderers.sh
step "KDE scene stays light (coast)"              tests/kde-perf.sh coast
step "KDE scene stays light (oasis)"              tests/kde-perf.sh oasis
step "KDE scene stays light (amman)"              tests/kde-perf.sh amman
step "KDE scene with rain stays reasonable"      tests/kde-perf.sh amman rain
tools/build-gnome.sh >/dev/null
for theme in coast dunes plateau oasis amman; do
    step "GNOME Shell headless: $theme"          bash -c "tests/gnome-headless.sh $theme 12 2>&1 | grep -E '^\s+State:' | sort -u | grep -q ACTIVE"
done
for weather in rain storm snow fog; do
    step "GNOME Shell headless: weather $weather"  bash -c "WEATHER=$weather tests/gnome-headless.sh amman 12 2>&1 | grep -E '^\s+State:' | sort -u | grep -q ACTIVE"
done
echo; [ $status = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $status
