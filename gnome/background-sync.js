// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';

const KEYS = ['picture-uri', 'picture-uri-dark'];
const MIN_INTERVAL = 60_000_000;

export class BackgroundSync {
    constructor() {
        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
        this._entries = new Map(KEYS.map(key => [key, {
            previous: this._settings.get_user_value(key),
            last: null,
            released: false,
        }]));
        this._nextUpdate = 0;
    }

    // `source` is a URI, or a function returning one (called only when an update is due).
    update(source, monotonic, force = false) {
        if (!force && monotonic < this._nextUpdate)
            return;

        this._nextUpdate = monotonic + MIN_INTERVAL;
        const uri = typeof source === 'function' ? source() : source;
        for (const [key, entry] of this._entries) {
            if (entry.released || !this._settings.is_writable(key))
                continue;

            const current = this._settings.get_string(key);
            if (entry.last !== null && current !== entry.last) {
                // A wallpaper selected while Coast Live is active takes priority.
                entry.released = true;
                continue;
            }
            if (current !== uri && this._settings.set_string(key, uri))
                entry.last = uri;
        }
    }

    restore() {
        for (const [key, entry] of this._entries) {
            if (entry.last === null || entry.released || !this._settings.is_writable(key)
                || this._settings.get_string(key) !== entry.last)
                continue;

            if (entry.previous === null)
                this._settings.reset(key);
            else
                this._settings.set_value(key, entry.previous);
        }
    }
}
