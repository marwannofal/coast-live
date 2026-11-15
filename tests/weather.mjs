// Weather: how weather reports map to scenes, and the Open-Meteo reply parser. No network.
import assert from 'node:assert/strict';
import {
    WEATHER_MODES, flashAlpha, parseWeatherResponse, weatherBands, weatherForMode, weatherFromCurrent,
    weatherLayers, weatherUrl,
} from '../core/weather.js';
import { lighting } from '../core/sky.js';

const kind = (code, cloud = 0, wind = 0) => weatherFromCurrent({ weather_code: code, cloud_cover: cloud, wind_speed_10m: wind }).kind;
assert.equal(kind(0), 'clear');
assert.equal(kind(1, 20), 'clear');
assert.equal(kind(3, 100), 'cloudy');
assert.equal(kind(45), 'fog');
assert.equal(kind(53), 'rain');
assert.equal(kind(65), 'rain');
assert.equal(kind(81), 'rain');
assert.equal(kind(73), 'snow');
assert.equal(kind(95), 'storm');
assert.equal(kind(99), 'storm');
assert.equal(weatherFromCurrent({ weather_code: 65 }).intensity, 1);
assert.ok(weatherFromCurrent({ weather_code: 61, cloud_cover: 0 }).cloud >= 0.8, 'rain is always overcast');

// Only a rounded position leaves the device.
assert.equal(weatherUrl(31.9539, 35.9106),
    'https://api.open-meteo.com/v1/forecast?latitude=32.0&longitude=35.9&current=weather_code,cloud_cover,wind_speed_10m&timezone=auto');
assert.ok(!/31\.95|35\.91/.test(weatherUrl(31.9539, 35.9106)));

// Parsing a real-shaped reply, and rubbish.
const reply = JSON.stringify({ current: { time: '2026-11-15T21:00', weather_code: 63, cloud_cover: 90, wind_speed_10m: 22.5 } });
assert.equal(parseWeatherResponse(reply).kind, 'rain');
assert.equal(parseWeatherResponse('not json'), null);
assert.equal(parseWeatherResponse('{"error":true}'), null);

// Every fixed mode (except off/live) is a real weather; layers exist only for rain, storm and snow.
for (const mode of WEATHER_MODES) {
    const w = weatherForMode(mode);
    assert.equal(w === null, mode === 'off' || mode === 'live', mode);
    if (w)
        assert.equal(weatherLayers(w).length > 0, ['rain', 'storm', 'snow'].includes(w.kind), mode);
}
const noon = lighting(1000);
assert.ok(weatherBands(noon, weatherForMode('clear')).every(b => b.alpha < 0.003), 'clear weather draws nothing');
assert.ok(weatherBands(noon, weatherForMode('fog')).some(b => b.alpha > 0.4), 'fog is visible');
assert.ok(weatherBands(noon, weatherForMode('cloudy')).every(b => b.alpha <= 1), 'alpha in range');
let flashes = 0;
for (let t = 0; t < 120; t += 0.05) flashes += flashAlpha(t, weatherForMode('storm')) > 0 ? 1 : 0;
assert.ok(flashes > 20 && flashes < 400, 'a thunderstorm flashes now and then (' + flashes + ' samples)');
assert.equal(flashAlpha(30, weatherForMode('rain')), 0, 'only storms flash');
console.log('weather ok');
