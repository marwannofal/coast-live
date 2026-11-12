#!/usr/bin/env bash
# Render a scene with the QML implementation, offscreen. See kde-harness.qml.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$root/dist/kde" ] || "$root/tools/build-kde.sh" >/dev/null
QT_FORCE_STDERR_LOGGING=1 QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software \
    timeout 60 qml6 "$root/tests/kde-harness.qml" -- "$@" 2>&1
