// SPDX-License-Identifier: GPL-2.0-or-later
import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: root
    twinFormLayouts: parentLayout

    property string cfg_Theme
    property int cfg_FrameRate
    property string cfg_WeatherMode
    property string cfg_TimeMode
    property int cfg_FixedMinutes
    property bool cfg_ManualLocation
    property real cfg_Latitude
    property real cfg_Longitude
    property alias formLayout: root

    readonly property var themes: [
        { value: "coast", text: i18n("Coast") },
        { value: "dunes", text: i18n("Golden Dunes") },
        { value: "plateau", text: i18n("Sandstone Plateau") },
        { value: "oasis", text: i18n("Desert Oasis") },
        { value: "amman", text: i18n("Amman") }
    ]
    readonly property var rates: [
        { value: 8, text: i18n("Economy · 8 FPS") },
        { value: 10, text: i18n("Balanced · 10 FPS") },
        { value: 15, text: i18n("Smooth · 15 FPS") },
        { value: 25, text: i18n("Ultra · 25 FPS") }
    ]

    QQC2.ComboBox {
        Kirigami.FormData.label: i18n("Scene:")
        textRole: "text"
        valueRole: "value"
        model: root.themes
        currentIndex: Math.max(0, root.themes.findIndex(t => t.value === root.cfg_Theme))
        onActivated: root.cfg_Theme = currentValue
    }
    QQC2.ComboBox {
        Kirigami.FormData.label: i18n("Frame rate:")
        textRole: "text"
        valueRole: "value"
        model: root.rates
        currentIndex: Math.max(0, root.rates.findIndex(r => r.value === root.cfg_FrameRate))
        onActivated: root.cfg_FrameRate = currentValue
    }
    Item { Kirigami.FormData.isSection: true; Kirigami.FormData.label: i18n("Weather") }
    QQC2.ComboBox {
        Kirigami.FormData.label: i18n("Weather:")
        textRole: "text"
        valueRole: "value"
        model: [
            { value: "off", text: i18n("Off") },
            { value: "live", text: i18n("Match the real weather") },
            { value: "clear", text: i18n("Clear") },
            { value: "cloudy", text: i18n("Cloudy") },
            { value: "fog", text: i18n("Fog") },
            { value: "drizzle", text: i18n("Drizzle") },
            { value: "rain", text: i18n("Rain") },
            { value: "storm", text: i18n("Thunderstorm") },
            { value: "snow", text: i18n("Snow") }
        ]
        currentIndex: Math.max(0, ["off", "live", "clear", "cloudy", "fog", "drizzle", "rain", "storm", "snow"].indexOf(root.cfg_WeatherMode))
        onActivated: root.cfg_WeatherMode = currentValue
    }
    QQC2.Label {
        Layout.maximumWidth: Kirigami.Units.gridUnit * 20
        wrapMode: Text.WordWrap
        opacity: 0.7
        text: i18n("“Match the real weather” asks open-meteo.com every 30 minutes and sends your approximate position (rounded to about 11 km). Nothing is sent in the other modes.")
    }
    Item { Kirigami.FormData.isSection: true; Kirigami.FormData.label: i18n("Time of day") }
    QQC2.ComboBox {
        Kirigami.FormData.label: i18n("Time:")
        textRole: "text"
        valueRole: "value"
        model: [
            { value: "auto", text: i18n("Automatic (follow the sun)") },
            { value: "fixed", text: i18n("Choose a time") }
        ]
        currentIndex: root.cfg_TimeMode === "fixed" ? 1 : 0
        onActivated: root.cfg_TimeMode = currentValue
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Chosen time:")
        enabled: root.cfg_TimeMode === "fixed"
        QQC2.SpinBox {
            from: 0; to: 23
            value: Math.floor(root.cfg_FixedMinutes / 60)
            onValueModified: root.cfg_FixedMinutes = value * 60 + root.cfg_FixedMinutes % 60
        }
        QQC2.Label { text: ":" }
        QQC2.SpinBox {
            from: 0; to: 55; stepSize: 5
            value: root.cfg_FixedMinutes % 60
            onValueModified: root.cfg_FixedMinutes = Math.floor(root.cfg_FixedMinutes / 60) * 60 + value
        }
    }
    Item { Kirigami.FormData.isSection: true; Kirigami.FormData.label: i18n("Solar location") }
    QQC2.CheckBox {
        text: i18n("Use custom coordinates")
        checked: root.cfg_ManualLocation
        onToggled: root.cfg_ManualLocation = checked
    }
    QQC2.TextField {
        Kirigami.FormData.label: i18n("Latitude:")
        enabled: root.cfg_ManualLocation
        text: root.cfg_Latitude.toFixed(4)
        validator: DoubleValidator { bottom: -90; top: 90; decimals: 4; notation: DoubleValidator.StandardNotation }
        onEditingFinished: root.cfg_Latitude = parseFloat(text) || 0
    }
    QQC2.TextField {
        Kirigami.FormData.label: i18n("Longitude:")
        enabled: root.cfg_ManualLocation
        text: root.cfg_Longitude.toFixed(4)
        validator: DoubleValidator { bottom: -180; top: 180; decimals: 4; notation: DoubleValidator.StandardNotation }
        onEditingFinished: root.cfg_Longitude = parseFloat(text) || 0
    }
    QQC2.Label {
        Layout.maximumWidth: Kirigami.Units.gridUnit * 20
        wrapMode: Text.WordWrap
        opacity: 0.7
        text: i18n("Without custom coordinates the sun follows your system time zone.")
    }
}
