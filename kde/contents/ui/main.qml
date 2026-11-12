// SPDX-License-Identifier: GPL-2.0-or-later
import QtQuick
import org.kde.plasma.plasmoid

WallpaperItem {
    id: wallpaper

    // Optional: if the time engine is unavailable the scene falls back to the clock offset.
    Loader {
        id: timeZone
        source: "TimeZoneSource.qml"
    }

    CoastScene {
        anchors.fill: parent
        theme: wallpaper.configuration.Theme
        frameInterval: Math.round(1000 / Math.max(1, wallpaper.configuration.FrameRate))
        manualLocation: wallpaper.configuration.ManualLocation
        latitude: wallpaper.configuration.Latitude
        longitude: wallpaper.configuration.Longitude
        zoneName: timeZone.item ? timeZone.item.zone : ""
        utcOffsetSeconds: timeZone.item && timeZone.item.offsetSeconds !== 0
            ? timeZone.item.offsetSeconds : -new Date().getTimezoneOffset() * 60
    }
}
