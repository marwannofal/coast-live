// Try the KDE scene live in an ordinary window, WITHOUT installing anything into Plasma.
// If it ever feels heavy, just close the window (or Ctrl+C in the terminal).
//   tools/build-kde.sh && qml6 tests/kde-window.qml -- coast        (coast | dunes | plateau | oasis)
import QtQuick
import QtQuick.Window
import "../dist/kde/org.coastlive.wallpaper/contents/ui"

Window {
    visible: true
    width: 960
    height: 540
    title: "Coast Live (test window)"
    readonly property var args: Qt.application.arguments.slice(Qt.application.arguments.indexOf("--") + 1)
    CoastScene {
        anchors.fill: parent
        theme: args.length && args[0] ? args[0] : "coast"
        frameInterval: 100
    }
}
