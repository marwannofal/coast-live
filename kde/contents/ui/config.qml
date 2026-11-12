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
    property bool cfg_ManualLocation
    property real cfg_Latitude
    property real cfg_Longitude
    property alias formLayout: root

    readonly property var themes: [
        { value: "coast", text: i18n("Coast") },
        { value: "dunes", text: i18n("Golden Dunes") },
        { value: "plateau", text: i18n("Sandstone Plateau") },
        { value: "oasis", text: i18n("Desert Oasis") }
    ]
    readonly property var rates: [
        { value: 8, text: i18n("Economy · 8 FPS") },
        { value: 15, text: i18n("Balanced · 15 FPS") },
        { value: 25, text: i18n("Smooth · 25 FPS") },
        { value: 50, text: i18n("Ultra · 50 FPS") }
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
