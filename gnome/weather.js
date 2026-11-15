// SPDX-License-Identifier: GPL-2.0-or-later
// Fetches the current weather for "Match the real weather". It only runs in that mode: one small request
// every 30 minutes to open-meteo.com (free, no account), carrying the position rounded to 0.1 degree.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import { WEATHER_REFRESH_MS, parseWeatherResponse, weatherUrl } from './core/weather.js';

export class WeatherFeed {
    // coordinates(): () => [latitude, longitude];  onChange(): called when a new report arrives.
    constructor(coordinates, onChange) {
        this._coordinates = coordinates;
        this._onChange = onChange;
        this._session = new Soup.Session({ timeout: 20, user_agent: 'coast-live-wallpaper' });
        this._cancellable = null;
        this._timer = 0;
        this.weather = null;
    }

    start() {
        if (this._timer)
            return;
        this._refresh();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, WEATHER_REFRESH_MS / 1000, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stop() {
        if (this._timer)
            GLib.Source.remove(this._timer);
        this._timer = 0;
        this._cancellable?.cancel();
        this._cancellable = null;
        this.weather = null;
    }

    _refresh() {
        this._cancellable?.cancel();
        const cancellable = this._cancellable = new Gio.Cancellable();
        const [latitude, longitude] = this._coordinates();
        const message = Soup.Message.new('GET', weatherUrl(latitude, longitude));
        this._session.send_and_read_async(message, GLib.PRIORITY_LOW, cancellable, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.get_status() !== Soup.Status.OK)
                    return;
                const weather = parseWeatherResponse(new TextDecoder().decode(bytes.get_data()));
                if (weather) {
                    this.weather = weather;
                    this._onChange();
                }
            } catch (error) {
                // Offline or cancelled: keep showing the last report (or none).
            }
        });
    }
}
