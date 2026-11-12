#!/usr/bin/env bash
# Build the Android APK without Gradle (aapt2 -> javac -> d8 -> zipalign -> apksigner).
#
# Usage: tools/build-android.sh [OUTPUT_DIR]      (default: dist/)
# Needs: JDK 17+, node, zip, and two Android SDK pieces:
#   ANDROID_JAR          path to android.jar         (SDK platform 34+)
#   ANDROID_BUILD_TOOLS  path to build-tools/34.x    (aapt2, d8, zipalign, apksigner)
# Optional: R8_JAR=path/to/r8.jar uses that D8 instead of build-tools' d8. build-tools 34's D8 (8.2)
#   fails on class files from very new JDKs; r8-8.5+ from https://dl.google.com/dl/android/maven2 works.
# or ANDROID_HOME pointing at a normal SDK layout (platforms/android-*/, build-tools/*/).
#
# The APK is signed with android/debug.keystore, created on first use (git-ignored).
# Sideloaded updates only install over earlier builds signed with the same key.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=${1:-$root/dist}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

if [ -z "${ANDROID_JAR:-}" ] && [ -n "${ANDROID_HOME:-}" ]; then
    ANDROID_JAR=$(ls -d "$ANDROID_HOME"/platforms/android-*/android.jar | sort -V | tail -1)
fi
if [ -z "${ANDROID_BUILD_TOOLS:-}" ] && [ -n "${ANDROID_HOME:-}" ]; then
    ANDROID_BUILD_TOOLS=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
fi
: "${ANDROID_JAR:?set ANDROID_JAR or ANDROID_HOME}" "${ANDROID_BUILD_TOOLS:?set ANDROID_BUILD_TOOLS or ANDROID_HOME}"
bt=$ANDROID_BUILD_TOOLS

mkdir -p "$out" "$work/gen/org/coastlive/core" "$work/assets/data" "$work/classes" "$work/dex"

# Generated Java (terrain layout) from the shared assets/themes/layout.json.
node "$root/tools/gen-android-layout.mjs" > "$work/gen/org/coastlive/core/Layout.java"

# Assets: terrain layers and time-zone data (the lit stills are only for the GNOME background).
for theme in dunes plateau oasis; do
    mkdir -p "$work/assets/themes/$theme"
    cp "$root"/assets/themes/$theme/ground-*.png "$work/assets/themes/$theme/"
    cp "$root"/assets/themes/$theme/palm-*.png "$work/assets/themes/$theme/" 2>/dev/null || true
done
cp "$root"/assets/data/zone.tab "$root"/assets/data/zone-links.txt "$work/assets/data/"

"$bt/aapt2" compile --dir "$root/android/res" -o "$work/res.zip"
"$bt/aapt2" link -o "$work/base.apk" -I "$ANDROID_JAR" \
    --manifest "$root/android/AndroidManifest.xml" \
    --min-sdk-version 24 --target-sdk-version 34 --version-code 5 --version-name 5.0 \
    -A "$work/assets" "$work/res.zip"

javac --release 17 -Xlint:-options -classpath "$ANDROID_JAR" -d "$work/classes" \
    $(find "$root/android/core" "$root/android/app" "$work/gen" -name '*.java')
if [ -n "${R8_JAR:-}" ]; then d8=(java -cp "$R8_JAR" com.android.tools.r8.D8); else d8=("$bt/d8"); fi
"${d8[@]}" --release --min-api 24 --lib "$ANDROID_JAR" --output "$work/dex" $(find "$work/classes" -name '*.class')
(cd "$work/dex" && zip -q "$work/base.apk" classes.dex)

"$bt/zipalign" -f -p 4 "$work/base.apk" "$work/aligned.apk"

keystore=$root/android/debug.keystore
if [ ! -f "$keystore" ]; then
    keytool -genkeypair -keystore "$keystore" -storepass android -keypass android -alias coastlive \
        -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Coast Live Debug" >/dev/null 2>&1
fi
"$bt/apksigner" sign --ks "$keystore" --ks-pass pass:android --key-pass pass:android \
    --out "$out/coast-live.apk" "$work/aligned.apk"
"$bt/apksigner" verify "$out/coast-live.apk"
ls -l "$out/coast-live.apk"
