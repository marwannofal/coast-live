// SPDX-License-Identifier: GPL-2.0-or-later
// Weather: what the scene should show (rain, snow, fog, overcast, thunderstorm), how to read it from a weather
// report, and how to draw it. Pure functions, drawn through the same `paint` interface as everything else.
//
// A weather state is { kind, intensity, cloud, wind }:
//   kind       'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'
//   intensity  0..1   how heavy the rain / snow / fog is
//   cloud      0..1   how overcast the sky is (dims and greys the whole picture)
//   wind       0..1   slants falling rain
import { TAU, blend, clamp, hash, mix, seededRandom, smooth, wrap } from './math.js';
import { HEIGHT, WIDTH } from './config.js';

// Where the weather comes from. 'live' needs the network (one small request every 30 minutes, see
// weatherUrl); the rest show a fixed weather, which works offline and is handy for trying the effects.
export const WEATHER_MODES = ['off', 'live', 'clear', 'cloudy', 'fog', 'drizzle', 'rain', 'storm', 'snow'];
export const WEATHER_MODE_NAMES = ['Off', 'Match the real weather', 'Clear', 'Cloudy', 'Fog', 'Drizzle', 'Rain', 'Thunderstorm', 'Snow'];
export const WEATHER_REFRESH_MS = 30 * 60_000;

export const NO_WEATHER = { kind: 'clear', intensity: 0, cloud: 0, wind: 0.2 };

const PRESETS = {
    clear: NO_WEATHER,
    cloudy: { kind: 'cloudy', intensity: 0, cloud: 0.85, wind: 0.3 },
    fog: { kind: 'fog', intensity: 0.8, cloud: 0.4, wind: 0.1 },
    drizzle: { kind: 'rain', intensity: 0.3, cloud: 0.8, wind: 0.2 },
    rain: { kind: 'rain', intensity: 0.7, cloud: 0.95, wind: 0.4 },
    storm: { kind: 'storm', intensity: 1, cloud: 1, wind: 0.8 },
    snow: { kind: 'snow', intensity: 0.6, cloud: 0.85, wind: 0.2 },
};

// The weather for a fixed mode; null for 'off' and 'live' (those have no preset).
export const weatherForMode = mode => Object.prototype.hasOwnProperty.call(PRESETS, mode) ? PRESETS[mode] : null;

// Only the position rounded to 0.1 degree (about 11 km) leaves the device; that is plenty for weather.
export function weatherUrl(latitude, longitude) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude.toFixed(1)
        + '&longitude=' + longitude.toFixed(1)
        + '&current=weather_code,cloud_cover,wind_speed_10m&timezone=auto';
}

// WMO weather code (https://open-meteo.com/en/docs) + cloud cover (%) + wind (km/h) -> weather state.
export function weatherFromCurrent({ weather_code: code = 0, cloud_cover: cover = 0, wind_speed_10m: windSpeed = 0 }) {
    const cloud = clamp(cover / 100);
    const wind = clamp(windSpeed / 45);
    const rain = { 51: 0.25, 53: 0.35, 55: 0.45, 56: 0.35, 57: 0.5, 61: 0.45, 63: 0.7, 65: 1, 66: 0.5, 67: 0.9,
        80: 0.5, 81: 0.8, 82: 1 }[code];
    const snow = { 71: 0.4, 73: 0.7, 75: 1, 77: 0.4, 85: 0.5, 86: 0.9 }[code];
    if (code >= 95)
        return { kind: 'storm', intensity: 1, cloud: 1, wind: Math.max(wind, 0.5) };
    if (snow !== undefined)
        return { kind: 'snow', intensity: snow, cloud: Math.max(cloud, 0.8), wind };
    if (rain !== undefined)
        return { kind: 'rain', intensity: rain, cloud: Math.max(cloud, 0.8), wind };
    if (code === 45 || code === 48)
        return { kind: 'fog', intensity: 0.8, cloud: Math.max(cloud, 0.4), wind };
    return { kind: cloud > 0.6 ? 'cloudy' : 'clear', intensity: 0, cloud, wind };
}

// Reads the reply of weatherUrl(); null if it is not what we expected.
export function parseWeatherResponse(text) {
    let current = null;
    try {
        current = JSON.parse(text).current;
    } catch (error) {
        return null;
    }
    return current && typeof current.weather_code === 'number' ? weatherFromCurrent(current) : null;
}

// ---- overcast and fog: horizontal bands tinted over the whole picture (identical on every platform)

export const BAND_HEIGHT = 10;
export const BAND_COUNT = HEIGHT / BAND_HEIGHT;

const FOG_PROFILE = [[0, 0.45], [200, 0.85], [320, 0.92], [HEIGHT, 0.42]];   // fog hides the far city most

function profile(points, y) {
    for (let i = 1; i < points.length; i++)
        if (y <= points[i][0])
            return mix(points[i - 1][1], points[i][1], (y - points[i - 1][0]) / (points[i][0] - points[i - 1][0]));
    return points[points.length - 1][1];
}

// BAND_COUNT bands { y, height, color, alpha } from top to bottom; alpha 0 where nothing is drawn.
export function weatherBands(light, weather) {
    const day = clamp(light.day / 255);
    const grey = blend([46, 52, 74], [122, 131, 147], day);
    const fogColor = blend([58, 64, 86], [212, 216, 220], day);
    const wet = weather.kind === 'rain' || weather.kind === 'storm' ? weather.intensity : 0;
    const strength = 0.6 + 0.4 * day;                 // at night the overcast hides less
    const skyAlpha = clamp(0.80 * weather.cloud ** 1.3 + 0.12 * wet) * strength;
    const groundAlpha = clamp(0.30 * weather.cloud ** 1.3 + 0.08 * wet) * strength;
    const fog = weather.kind === 'fog' ? weather.intensity : 0;
    return Array.from({ length: BAND_COUNT }, (_, row) => {
        const y = (row + 0.5) * BAND_HEIGHT;
        const cloudAlpha = mix(skyAlpha, groundAlpha, smooth(y / HEIGHT));
        const fogAlpha = fog * profile(FOG_PROFILE, y);
        const alpha = 1 - (1 - cloudAlpha) * (1 - fogAlpha);
        // The fog sits on top of the overcast: composite its colour over the grey.
        const color = alpha > 0
            ? grey.map((g, i) => (fogColor[i] * fogAlpha + g * cloudAlpha * (1 - fogAlpha)) / alpha)
            : grey;
        return { y: row * BAND_HEIGHT, height: BAND_HEIGHT, color, alpha };
    });
}

// ---- rain and snow: a few layers of falling particles
//
// Each layer falls at its own speed (far layers are slow and faint, near ones fast and bright), which gives depth.
// A layer scrolls HEIGHT pixels per cycle, so platforms can paint a layer ONCE into a tile and let the GPU scroll it
// (GNOME, KDE), or paint it at the right offset every frame (Android): the pictures are identical.

const RAIN_LAYERS = [
    { speed: 380, length: 5, span: 3, share: 0.40, alpha: 0.55 },
    { speed: 540, length: 8, span: 4, share: 0.35, alpha: 0.80 },
    { speed: 740, length: 12, span: 5, share: 0.25, alpha: 1.00 },
];
const SNOW_LAYERS = [
    { speed: 26, size: 2, share: 0.50, alpha: 0.70 },
    { speed: 40, size: 3, share: 0.30, alpha: 0.85 },
    { speed: 60, size: 4, share: 0.20, alpha: 1.00 },
];
const MAX_PER_LAYER = 140;
const layerRandom = [0, 1, 2].map(k => {
    const next = seededRandom(4417 + k * 101);
    return Array.from({ length: MAX_PER_LAYER }, () => [next(), next(), next()]);
});

export function particleCount(weather) {
    if (weather.kind === 'storm') return 310;
    if (weather.kind === 'rain') return Math.round(90 + 200 * weather.intensity);
    if (weather.kind === 'snow') return Math.round(70 + 190 * weather.intensity);
    return 0;
}

// The layers to draw for this weather: [{ speed, alpha, count, length, span | size }]; empty when it is not raining.
export function weatherLayers(weather) {
    const total = particleCount(weather);
    const layers = weather.kind === 'snow' ? SNOW_LAYERS : total > 0 ? RAIN_LAYERS : [];
    return layers.map(layer => Object.assign({}, layer, { count: Math.min(MAX_PER_LAYER, Math.round(total * layer.share)) }));
}

// Seconds one layer takes to fall HEIGHT pixels (one full scroll of its tile).
export const layerPeriod = layer => HEIGHT / layer.speed;

export function particleStyle(light, weather) {
    const day = clamp(light.day / 255);
    return weather.kind === 'snow'
        ? { color: blend([185, 195, 225], [255, 255, 255], day), alpha: 0.95 }
        : { color: blend([175, 190, 230], [225, 235, 250], day), alpha: 0.55 + 0.15 * weather.intensity };
}

// Paints the particles of layer `index`, as they are `scroll` pixels into their fall, in a strip `width` pixels wide
// (a strip narrower than the screen has proportionally fewer particles, so it can be tiled across it).
// Set the colour first (paint.color); the caller fills.
export function paintLayer(paint, weather, index, width, scroll) {
    const layer = weatherLayers(weather)[index];
    const snow = weather.kind === 'snow';
    const slant = weather.wind > 0.35;
    const count = Math.round(layer.count * width / WIDTH);   // a narrower strip holds proportionally fewer
    for (let j = 0; j < count; j++) {
        const [a, b, c] = layerRandom[index][j % MAX_PER_LAYER];
        const x = Math.round(a * width);
        const y = Math.round(wrap(b * HEIGHT + scroll, HEIGHT));
        if (snow) {
            paint.rectangle(x, y, layer.size, layer.size);
            if (y + layer.size > HEIGHT)
                paint.rectangle(x, y - HEIGHT, layer.size, layer.size);
            continue;
        }
        const length = layer.length + Math.floor(c * layer.span);
        for (const top of y + length > HEIGHT ? [y, y - HEIGHT] : [y]) {
            if (slant) {
                const half = Math.floor(length / 2);
                paint.rectangle(x, top, 1, half);
                paint.rectangle(x + 1, top + half, 1, length - half);
            } else
                paint.rectangle(x, top, 1, length);
        }
    }
}

// ---- lightning: now and then a double flash (0..1 white overlay), only in a thunderstorm

const FLASH_PERIOD = 9;

export function flashAlpha(elapsed, weather) {
    if (weather.kind !== 'storm')
        return 0;
    const n = Math.floor(elapsed / FLASH_PERIOD);
    const t = elapsed - (n * FLASH_PERIOD + 2 + hash(n, 1) * 5);
    if (t < 0 || t > 0.55)
        return 0;
    const flicker = t < 0.08 ? 1 : t < 0.16 ? 0.2 : t < 0.26 ? 0.8 : Math.max(0, 1 - (t - 0.26) / 0.29) * 0.5;
    return 0.55 * flicker;
}

// Whether anything on screen moves (so the platform knows it must redraw every tick).
export const isAnimated = weather => particleCount(weather) > 0 || weather.kind === 'storm';
export const isVisible = weather => isAnimated(weather) || weather.cloud > 0.05 || weather.kind === 'fog';

// The still part of the weather (overcast and fog), drawn over everything.
export function paintOverlay(paint, light, weather) {
    for (const band of weatherBands(light, weather)) {
        if (band.alpha < 0.003)
            continue;
        paint.color(band.color, band.alpha);
        paint.rectangle(0, band.y, WIDTH, band.height);
        paint.fill();
    }
}

// Everything at once, as one picture at time `elapsed` (renders and the Android wallpaper).
export function paintWeather(paint, elapsed, light, weather) {
    paintOverlay(paint, light, weather);
    const style = particleStyle(light, weather);
    weatherLayers(weather).forEach((layer, index) => {
        paint.color(style.color, style.alpha * layer.alpha);
        paintLayer(paint, weather, index, WIDTH, elapsed * layer.speed);
        paint.fill();
    });
    const flash = flashAlpha(elapsed, weather);
    if (flash > 0) {
        paint.color([235, 240, 255], flash);
        paint.rectangle(0, 0, WIDTH, HEIGHT);
        paint.fill();
    }
}
