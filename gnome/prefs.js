// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { THEMES, THEME_NAMES } from './core/themes.js';
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
