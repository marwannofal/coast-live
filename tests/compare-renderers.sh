#!/usr/bin/env bash
# Render the same scenes with the GNOME reference (GJS + Cairo) and the Java core,
# then check that they agree. Skips an implementation whose tools are missing.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
scenes=("coast 1000 12" "coast 1560 30" "coast 150 5" "dunes 1000 8" "plateau 1560 8" "oasis 1000 8")

for s in "${scenes[@]}"; do read -r theme frame elapsed <<<"$s"
    gjs -m tools/render-scene.js "$theme" "$frame" "$elapsed" "$tmp/ref-$theme-$frame.png" >/dev/null
done

if command -v javac >/dev/null; then
    mkdir -p "$tmp/jvm"
    node tools/gen-android-layout.mjs > "$tmp/Layout.java"
    javac --release 17 -d "$tmp/jvm" android/core/org/coastlive/core/*.java "$tmp/Layout.java" android/test/org/coastlive/test/*.java
    for s in "${scenes[@]}"; do read -r theme frame elapsed <<<"$s"
        java -cp "$tmp/jvm" org.coastlive.test.RenderScene assets/themes "$theme" "$frame" "$elapsed" "$tmp/java-$theme-$frame.png"
    done
fi
python3 tests/compare.py "$tmp"
