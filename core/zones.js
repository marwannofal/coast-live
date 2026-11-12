// SPDX-License-Identifier: GPL-2.0-or-later
function parseAngle(value, degreeDigits) {
    const sign = value[0] === '-' ? -1 : 1;
    const degrees = Number(value.slice(1, 1 + degreeDigits));
    const minutes = Number(value.slice(1 + degreeDigits, 3 + degreeDigits));
    const seconds = Number(value.slice(3 + degreeDigits));
    return sign * (degrees + minutes / 60 + seconds / 3600);
}

export function parseZoneTable(text) {
    const zones = new Map();
    for (const line of text.split('\n')) {
        if (line.startsWith('#') || !line.trim())
            continue;
        const [, coords, name] = line.split('\t');
        const match = coords?.match(/^([+-]\d{4}(?:\d{2})?)([+-]\d{5}(?:\d{2})?)$/);
        if (match && name)
            zones.set(name.trim(), [parseAngle(match[1], 2), parseAngle(match[2], 3)]);
    }
    return zones;
}

export function parseZoneLinks(text) {
    const aliases = new Map();
    for (const line of text.split('\n')) {
        const match = line.match(/^(?:L|Link)\s+(\S+)\s+(\S+)/);
        if (match)
            aliases.set(match[2], match[1]);
    }
    return aliases;
}

export function normalizeZoneName(identifier) {
    return identifier.replace(/^:/, '')
        .replace(/^.*\/zoneinfo\//, '')
        .replace(/^(?:posix|right)\//, '');
}

export function coordinatesForZone(zones, links, identifier) {
    let name = normalizeZoneName(identifier);
    const visited = new Set();
    while (name && !visited.has(name)) {
        const coordinates = zones.get(name);
        if (coordinates)
            return coordinates;
        visited.add(name);
        name = links.get(name);
    }
    return null;
}

export function coordinatesForOffset(offsetSeconds) {
    const longitude = ((offsetSeconds / 240 + 180) % 360 + 360) % 360 - 180;
    return [0, longitude];
}

// Best-effort coordinates for a time zone: the zone's representative city, or
// an estimate from the clock offset when the zone is unknown.
export function resolveCoordinates(zones, links, zoneName, offsetSeconds) {
    const coordinates = coordinatesForZone(zones, links, zoneName);
    return coordinates
        ? { coordinates, source: 'zone' }
        : { coordinates: coordinatesForOffset(offsetSeconds), source: 'offset' };
}
