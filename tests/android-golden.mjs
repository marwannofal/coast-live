// Writes reference data from the JavaScript core for the Java port to be checked against.
// Usage: node tests/android-golden.mjs OUT_DIR
import fs from 'node:fs';
import { createSky, lighting } from '../core/sky.js';
import { COAST, makeCloudMasks } from '../core/shapes.js';
import { SolarTracker } from '../core/solar-clock.js';
import { parseZoneLinks, parseZoneTable, resolveCoordinates } from '../core/zones.js';
import { seededRandom } from '../core/math.js';
import { weatherBands, weatherFromCurrent, weatherLayers } from '../core/weather.js';

const out = process.argv[2];
fs.mkdirSync(`${out}/frames`, { recursive: true });
const w = (name, lines) => fs.writeFileSync(`${out}/${name}`, lines.join('\n') + '\n');

w('lighting.txt', Array.from({ length: 2000 }, (_, f) => {
    const l = lighting(f);
    return [f, ...l.sun, ...l.moon, ...l.sunlight, ...l.cloud, ...l.sea, ...l.grass, l.day].join(' ');
}));

w('coast.txt', [COAST.join(' ')]);
w('clouds.txt', makeCloudMasks().map(m => {
    let sum = 0;
    m.groups.forEach((spans, tone) => spans.forEach(([x, y, n]) => { sum = (sum + (tone * 1000003 + x * 31 + y * 17 + n * 7)) % 1000000007; }));
    return [m.w, m.h, m.groups.reduce((a, g) => a + g.length, 0), sum].join(' ');
}));

// Solar frames at many instants and places (including polar day/night and odd longitudes).
const rand = seededRandom(7);
const places = [[41.01, 28.98], [0, 45], [21.5, 39.2], [-33.9, 151.2], [64.1, -21.9], [78.2, 15.6], [-77.8, 166.7], [35, 139], [40.7, -74], [51.5, -0.1]];
const cases = [];
for (let i = 0; i < 400; i++) {
    const [lat, lon] = places[i % places.length];
    const time = Date.UTC(2024, 0, 1) + Math.floor(rand() * 2 * 365 * 86400000);
    cases.push([time, lat, lon, new SolarTracker().frameAt(time, lat, lon)]);
}
w('solar.txt', cases.map(c => c.join(' ')));

const zones = parseZoneTable(fs.readFileSync('assets/data/zone.tab', 'utf8'));
const links = parseZoneLinks(fs.readFileSync('assets/data/zone-links.txt', 'utf8'));
const names = ['Europe/Istanbul', 'Asia/Riyadh', 'America/New_York', 'Asia/Kolkata', 'Asia/Calcutta', 'Nowhere/Land', 'Etc/GMT-3', 'UTC', ':posix/Europe/Paris', 'America/Argentina/Buenos_Aires'];
w('zones.txt', names.map(n => {
    const r = resolveCoordinates(zones, links, n, 10800);
    return [n.replace(/ /g, '_'), 10800, r.coordinates[0], r.coordinates[1], r.source].join(' ');
}));

// Weather: every WMO code at a few cloud covers / winds, the band colours and the layer counts.
const weatherLines = [];
for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99, 12])
    for (const [cover, wind] of [[0, 0], [55, 12.5], [100, 60]]) {
        const x = weatherFromCurrent({ weather_code: code, cloud_cover: cover, wind_speed_10m: wind });
        const layers = weatherLayers(x).map(l => l.count).join(',') || '-';
        const bands = weatherBands(lighting(1000), x).map(b => b.alpha.toFixed(6)).join(',');
        weatherLines.push([code, cover, wind, x.kind, x.intensity, x.cloud.toFixed(9), x.wind.toFixed(9), layers, bands].join(' '));
    }
w('weather.txt', weatherLines);

const sky = createSky();
const buf = new Uint8Array(sky.byteLength);
for (const f of [0, 100, 359, 360, 400, 440, 700, 1000, 1400, 1559, 1560, 1640, 1700, 1850, 1999]) {
    sky.renderFrame(f, buf);
    fs.writeFileSync(`${out}/frames/${f}.rgb`, buf);
}
console.log('golden data written to', out);
