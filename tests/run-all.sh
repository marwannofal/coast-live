#!/usr/bin/env bash
# Everything that can be verified on a desktop. Needs gjs, node, java, qml6, python3 (numpy, PIL).
# GNOME Shell itself is exercised headless in an isolated session (no effect on your desktop).
set -uo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
status=0
step() { printf '\n=== %s\n' "$1"; shift; "$@" || status=1; }

step "core loads (node)"                         node tests/core-loads.mjs
step "core runs under GJS and is fast enough"    gjs -m tests/gjs-smoke.js "$(mktemp -d)"
step "Java port == JavaScript core"              bash -c '
    tmp=$(mktemp -d); node tests/android-golden.mjs "$tmp/golden" >/dev/null
    node tools/gen-android-layout.mjs > "$tmp/Layout.java"; mkdir "$tmp/jvm"
    javac --release 17 -d "$tmp/jvm" android/core/org/coastlive/core/*.java "$tmp/Layout.java" android/test/org/coastlive/test/*.java
    java -cp "$tmp/jvm" org.coastlive.test.GoldenTest "$tmp/golden" "$PWD"'
step "GNOME, QML and Java renderers agree"       tests/compare-renderers.sh
tools/build-gnome.sh >/dev/null
for theme in coast dunes plateau oasis; do
    step "GNOME Shell headless: $theme"          bash -c "tests/gnome-headless.sh $theme 12 2>&1 | grep -E '^\s+State:' | sort -u | grep -q ACTIVE"
done
echo; [ $status = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $status
