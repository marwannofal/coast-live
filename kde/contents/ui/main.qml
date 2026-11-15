// SPDX-License-Identifier: GPL-2.0-or-later
import QtQuick
import org.kde.plasma.plasmoid
import "../code/weather.mjs" as WeatherCore

WallpaperItem {
    id: wallpaper

    // Optional: if the time engine is unavailable the scene falls back to the clock offset.
    Loader {
        id: timeZone
        source: "TimeZoneSource.qml"
    }

    // "Match the real weather": one small request every 30 minutes to open-meteo.com, carrying the position rounded
    // to 0.1 degree. Nothing is sent in any other weather mode.
    function fetchWeather() {
        const place = scene.coordinates();
        const request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState !== XMLHttpRequest.DONE || request.status !== 200)
                return;
            const weather = WeatherCore.parseWeatherResponse(request.responseText);
            if (weather)
                scene.liveWeather = weather;
        };
        request.open("GET", WeatherCore.weatherUrl(place[0], place[1]));
        request.send();
    }
    Timer {
        interval: WeatherCore.WEATHER_REFRESH_MS
        repeat: true
        running: wallpaper.configuration.WeatherMode === "live"
        triggeredOnStart: true
        onTriggered: wallpaper.fetchWeather()
    }

    CoastScene {
        id: scene
        anchors.fill: parent
        weatherMode: wallpaper.configuration.WeatherMode
        theme: wallpaper.configuration.Theme
        frameInterval: Math.round(1000 / Math.max(1, wallpaper.configuration.FrameRate))
        timeMode: wallpaper.configuration.TimeMode
        fixedMinutes: wallpaper.configuration.FixedMinutes
        manualLocation: wallpaper.configuration.ManualLocation
        latitude: wallpaper.configuration.Latitude
        longitude: wallpaper.configuration.Longitude
        zoneName: timeZone.item ? timeZone.item.zone : ""
        utcOffsetSeconds: timeZone.item && timeZone.item.offsetSeconds !== 0
            ? timeZone.item.offsetSeconds : -new Date().getTimezoneOffset() * 60
    }
}
