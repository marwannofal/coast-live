// Renders the QML scene (built by tools/build-kde.sh) into a PNG for testing.
// Usage: tests/kde-render.sh THEME FRAME ELAPSED OUT.png [WEATHER]
import QtQuick
import QtQuick.Window
import "../dist/kde/org.coastlive.wallpaper/contents/ui"

Window {
    id: win
    visible: true
    width: 960
    height: 540
    readonly property var args: Qt.application.arguments.slice(Qt.application.arguments.indexOf("--") + 1)

    CoastScene {
        id: scene
        anchors.fill: parent
        theme: win.args[0]
        testFrame: Number(win.args[1])
        testElapsed: Number(win.args[2])
        weatherMode: win.args[4] || "off"
    }
    Timer {
        interval: 6000
        running: true
        onTriggered: scene.grabToImage(function (result) {
            console.log("saved:", result.saveToFile(win.args[3]));
            Qt.quit();
        })
    }
}
