// SPDX-License-Identifier: GPL-2.0-or-later
import GLib from 'gi://GLib';
import {
    coordinatesForOffset, coordinatesForZone, normalizeZoneName, parseZoneLinks, parseZoneTable,
} from './core/zones.js';

function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? new TextDecoder().decode(bytes) : '';
    } catch {
        return '';
    }
}

export class LocalLocation {
    constructor(extensionPath) {
        const directory = GLib.getenv('TZDIR') || '/usr/share/zoneinfo';
        this._zones = parseZoneTable(readText(extensionPath + '/data/zone.tab'));
        const systemTable = readText(directory + '/zone.tab') || readText(directory + '/zone1970.tab');
        for (const [name, coordinates] of parseZoneTable(systemTable))
            this._zones.set(name, coordinates);
        this._links = parseZoneLinks(readText(extensionPath + '/data/zone-links.txt'));
        for (const [alias, target] of parseZoneLinks(readText(directory + '/tzdata.zi')))
            this._links.set(alias, target);
    }

    resolve(settings = null, time = Date.now()) {
        const zone = GLib.TimeZone.new_local();
        let identifier = normalizeZoneName(zone.get_identifier() || '');
        if (!identifier || identifier === '/etc/localtime' || identifier === 'localtime') {
            try {
                identifier = GLib.file_read_link('/etc/localtime');
            } catch {
                identifier = readText('/etc/timezone').trim();
            }
        }
        const name = normalizeZoneName(identifier || 'Local time');
        if (settings?.get_boolean('manual-location'))
            return { name, coordinates: [settings.get_double('latitude'), settings.get_double('longitude')], source: 'manual' };

        const coordinates = coordinatesForZone(this._zones, this._links, name);
        if (coordinates)
            return { name, coordinates, source: 'zone' };

        const interval = zone.find_interval(GLib.TimeType.UNIVERSAL, Math.floor(time / 1000));
        const offset = interval < 0 ? 0 : zone.get_offset(interval);
        return { name, coordinates: coordinatesForOffset(offset), source: 'offset' };
    }
}
