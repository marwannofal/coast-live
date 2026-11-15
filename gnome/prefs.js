// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { THEMES, THEME_NAMES } from './core/themes.js';
import { WEATHER_MODES, WEATHER_MODE_NAMES } from './core/weather.js';
import { LocalLocation } from './location.js';

const MODES = ['economy', 'balanced', 'smooth', 'ultra'];

export default class CoastLivePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const location = new LocalLocation(this.path);
        const page = new Adw.PreferencesPage({ title: 'Coast Live' });
        const scene = new Adw.PreferencesGroup({ title: 'Scene' });
        const theme = new Adw.ComboRow({
            title: 'Wallpaper',
            model: Gtk.StringList.new(THEME_NAMES),
            selected: THEMES.indexOf(settings.get_string('theme')),
        });
        theme.connect('notify::selected', () => {
            const selection = THEMES[theme.selected];
            if (selection)
                settings.set_string('theme', selection);
        });
        scene.add(theme);
        page.add(scene);
        const place = new Adw.PreferencesGroup({
            title: 'Solar location',
            description: 'Set your computer’s time zone in GNOME Settings. Custom coordinates refine sunrise and sunset for your city.',
        });
        const effective = new Adw.ActionRow({ title: 'Location in use' });
        const manual = new Adw.SwitchRow({ title: 'Use custom coordinates' });
        const latitude = Adw.SpinRow.new_with_range(-90, 90, 0.0001);
        latitude.title = 'Latitude';
        latitude.subtitle = 'North is positive.';
        latitude.digits = 4;
        const longitude = Adw.SpinRow.new_with_range(-180, 180, 0.0001);
        longitude.title = 'Longitude';
        longitude.subtitle = 'East is positive.';
        longitude.digits = 4;

        const updateLocation = () => {
            const { name, coordinates, source } = location.resolve(settings);
            const [lat, lon] = coordinates.map(value => value.toFixed(4));
            const detail = {
                manual: 'Custom coordinates',
                zone: 'Approximate time-zone coordinates',
                offset: 'Estimated from the clock offset. Enter coordinates for your city.',
            }[source];
            effective.subtitle = name + ' · ' + lat + ', ' + lon + '\n' + detail;
        };
        const editableValue = Gio.SettingsBindFlags.DEFAULT | Gio.SettingsBindFlags.NO_SENSITIVITY;
        settings.bind('latitude', latitude, 'value', editableValue);
        settings.bind('longitude', longitude, 'value', editableValue);
        manual.connect('notify::active', () => {
            if (!manual.active || settings.get_user_value('latitude') || settings.get_user_value('longitude'))
                return;

            const { coordinates } = location.resolve();
            settings.set_double('latitude', coordinates[0]);
            settings.set_double('longitude', coordinates[1]);
        });
        settings.bind('manual-location', manual, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('manual-location', latitude, 'sensitive', Gio.SettingsBindFlags.GET);
        settings.bind('manual-location', longitude, 'sensitive', Gio.SettingsBindFlags.GET);
        const locationSignals = ['manual-location', 'latitude', 'longitude'].map(key =>
            settings.connect('changed::' + key, updateLocation));
        window.connect('close-request', () => {
            for (const id of locationSignals)
                settings.disconnect(id);
            return false;
        });
        updateLocation();
        for (const row of [effective, manual, latitude, longitude])
            place.add(row);
        page.add(place);

        const timeGroup = new Adw.PreferencesGroup({
            title: 'Time of day',
            description: 'Follow the sun automatically, or show a fixed time of day (for example to keep a favourite sunset).',
        });
        const timeMode = new Adw.ComboRow({
            title: 'Time',
            model: Gtk.StringList.new(['Automatic (follow the sun)', 'Choose a time']),
            selected: settings.get_string('time-mode') === 'fixed' ? 1 : 0,
        });
        const hour = Adw.SpinRow.new_with_range(0, 23, 1);
        hour.title = 'Hour';
        const minute = Adw.SpinRow.new_with_range(0, 59, 5);
        minute.title = 'Minute';
        const loadTime = () => {
            const minutes = settings.get_int('fixed-minutes');
            hour.value = Math.floor(minutes / 60);
            minute.value = minutes % 60;
        };
        const saveTime = () => settings.set_int('fixed-minutes', Math.round(hour.value) * 60 + Math.round(minute.value));
        loadTime();
        hour.connect('notify::value', saveTime);
        minute.connect('notify::value', saveTime);
        const updateTimeRows = () => {
            const fixed = timeMode.selected === 1;
            hour.sensitive = fixed;
            minute.sensitive = fixed;
        };
        timeMode.connect('notify::selected', () => {
            settings.set_string('time-mode', timeMode.selected === 1 ? 'fixed' : 'auto');
            updateTimeRows();
        });
        updateTimeRows();
        for (const row of [timeMode, hour, minute])
            timeGroup.add(row);
        page.add(timeGroup);

        const weatherGroup = new Adw.PreferencesGroup({
            title: 'Weather',
            description: 'Show rain, snow, fog or storms over the scene. “Match the real weather” asks open-meteo.com every 30 minutes '
                + 'and sends your approximate position (rounded to about 11 km); nothing is sent in the other modes.',
        });
        const weatherMode = new Adw.ComboRow({
            title: 'Weather',
            model: Gtk.StringList.new(WEATHER_MODE_NAMES),
            selected: Math.max(0, WEATHER_MODES.indexOf(settings.get_string('weather-mode'))),
        });
        weatherMode.connect('notify::selected', () => {
            const mode = WEATHER_MODES[weatherMode.selected];
            if (mode)
                settings.set_string('weather-mode', mode);
        });
        weatherGroup.add(weatherMode);
        page.add(weatherGroup);

        const appearance = new Adw.PreferencesGroup({ title: 'Appearance' });
        const matchBackground = new Adw.SwitchRow({
            title: 'Match GNOME background',
            subtitle: 'Use a Coast Live still in GNOME Appearance and the Activities overview.',
        });
        settings.bind('match-gnome-background', matchBackground, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(matchBackground);
        page.add(appearance);

        const performance = new Adw.PreferencesGroup({ title: 'Animation' });
        const speed = new Adw.ComboRow({
            title: 'Frame rate',
            subtitle: 'Lower frame rates reduce how often the scene is redrawn.',
            model: Gtk.StringList.new(['Economy · 8 FPS', 'Balanced · 15 FPS', 'Smooth · 25 FPS', 'Ultra · 50 FPS']),
            selected: MODES.indexOf(settings.get_string('animation-speed')),
        });
        speed.connect('notify::selected', () => {
            const mode = MODES[speed.selected];
            if (mode)
                settings.set_string('animation-speed', mode);
        });
        performance.add(speed);
        page.add(performance);
        window.add(page);
    }
}
