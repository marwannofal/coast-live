// SPDX-License-Identifier: GPL-2.0-or-later
// Reads the system time zone from Plasma's "time" data engine.
import QtQuick
import org.kde.plasma.plasma5support as P5Support

Item {
    id: root
    readonly property string zone: source.data["Local"] ? (source.data["Local"]["Timezone"] || "") : ""
    readonly property real offsetSeconds: source.data["Local"] ? (source.data["Local"]["Offset"] || 0) : 0

    P5Support.DataSource {
        id: source
        engine: "time"
        connectedSources: ["Local"]
        interval: 60000
    }
}
