// SPDX-License-Identifier: GPL-2.0-or-later
// The procedural sky. This replaces the 2,000 pre-rendered JPEG frames: any
// lighting frame is computed on demand from seven colour palettes, a sun, a
// moon and a few stars.
//
//   lighting(frame)      -> colours/positions the other layers use (clouds, water, grass)
//   createSky({rows})    -> { renderFrame(frame, out) } fills an RGB byte buffer
//
// `frame` is a lighting-frame index, 0..SKY_FRAMES-1 (fractions are allowed).
import { HEIGHT, HORIZON, SKY_KEY_SCALE, WIDTH } from './config.js';
import { TAU, clamp, hash, mix, seededRandom, smooth } from './math.js';
import { COAST } from './shapes.js';

// Each palette is four sky stops (top to horizon), three sea stops and three meadow stops.
export const PALETTES = {
    night: {
        sky: [[12, 17, 52], [25, 20, 73], [49, 27, 91], [75, 58, 115]],
        sea: [[52, 63, 114], [20, 33, 81], [12, 23, 57]],
        meadow: [[54, 66, 48], [24, 42, 32], [12, 26, 23]],
    },
    'blue-hour': {
        sky: [[17, 20, 72], [28, 37, 128], [70, 55, 160], [157, 113, 174]],
        sea: [[138, 114, 164], [60, 67, 137], [31, 47, 96]],
        meadow: [[108, 108, 62], [56, 72, 51], [26, 47, 42]],
    },
    sunrise: {
        sky: [[42, 52, 150], [110, 78, 172], [207, 111, 162], [251, 176, 157]],
        sea: [[248, 186, 152], [164, 100, 146], [84, 68, 120]],
        meadow: [[206, 172, 70], [111, 112, 53], [55, 77, 45]],
    },
    morning: {
        sky: [[51, 148, 205], [69, 176, 220], [114, 202, 232], [195, 232, 234]],
        sea: [[187, 236, 238], [64, 153, 199], [39, 109, 159]],
        meadow: [[163, 205, 99], [97, 155, 72], [54, 111, 59]],
    },
    noon: {
        sky: [[64, 172, 218], [87, 198, 232], [133, 221, 240], [193, 242, 246]],
        sea: [[206, 245, 244], [60, 160, 214], [27, 108, 165]],
        meadow: [[183, 218, 106], [112, 166, 72], [54, 113, 59]],
    },
    evening: {
        sky: [[47, 77, 154], [106, 110, 184], [185, 135, 181], [246, 183, 162]],
        sea: [[236, 191, 174], [127, 110, 172], [61, 75, 138]],
        meadow: [[189, 177, 84], [97, 123, 63], [49, 86, 55]],
    },
    sunset: {
        sky: [[42, 35, 104], [123, 45, 127], [208, 66, 113], [255, 136, 92]],
        sea: [[247, 148, 108], [135, 67, 112], [72, 46, 85]],
        meadow: [[188, 133, 58], [100, 92, 46], [44, 63, 38]],
    },
};

// [key position, palette]. Positions are in "key units" (frame / SKY_KEY_SCALE).
const SKY_KEYS = [
    [0, 'night'], [63, 'night'], [90, 'blue-hour'], [110, 'sunrise'],
    [173, 'morning'], [250, 'noon'], [328, 'evening'], [390, 'sunset'],
    [410, 'blue-hour'], [452, 'night'], [500, 'night'],
];
const SUN_COLORS = [
    [110, [255, 229, 152]], [173, [221, 250, 255]], [250, [231, 252, 255]],
    [328, [255, 218, 193]], [390, [255, 196, 99]],
];
const CLOUD_COLORS = {
    night: [111, 52, 108], 'blue-hour': [130, 63, 143], sunrise: [255, 140, 185],
    morning: [247, 204, 255], noon: [229, 245, 255], evening: [252, 186, 216],
    sunset: [245, 97, 81],
};

const random = seededRandom(137);
const STARS = Array.from({ length: 28 }, () => [
    Math.floor(18 + random() * 925), Math.floor(17 + random() * 290),
    random(), random() * TAU,
]);

function gradientInto(colors, position, out) {
    const phase = clamp(position) * (colors.length - 1);
    const step = Math.min(colors.length - 2, Math.floor(phase));
    const from = colors[step];
    const to = colors[step + 1];
    const amount = phase - step;
    out[0] = from[0] + (to[0] - from[0]) * amount;
    out[1] = from[1] + (to[1] - from[1]) * amount;
    out[2] = from[2] + (to[2] - from[2]) * amount;
}

function keyInterval(keys, key) {
    const index = keys.findIndex(([point]) => key < point);
    if (index < 0) return [keys[keys.length - 1][1], keys[keys.length - 1][1], 0];
    if (index === 0) return [keys[0][1], keys[0][1], 0];
    const [from, before] = keys[index - 1];
    const [to, after] = keys[index];
    return [before, after, smooth((key - from) / (to - from))];
}

const toByte = value => Math.round(clamp(value / 255) * 255);

// The colour of one pixel of one palette plate, written into out[0..2].
// This is the reference formula; the plate builder below is a faster version of it.
export function shadePixel(name, x, y, out) {
    const { sky, sea, meadow } = PALETTES[name];
    let light;
    if (y < HORIZON) {
        gradientInto(sky, y / (HORIZON - 1), out);
        light = (hash(x, y) - 0.5) * 1.14;
    } else if (y < COAST[x]) {
        gradientInto(sea, (y - HORIZON) / 35, out);
        light = (hash(x, y) - 0.5) * 2.0;
    } else {
        const depth = y - COAST[x];
        gradientInto(meadow, (depth + 5 * Math.sin(x / 55 + depth / 12)) / 78, out);
        light = (hash(x, y) - 0.5) * (depth < 12 ? 11 : 3);
        if (depth < 2)
            light -= 17;
        if (depth < 21 && hash(x, Math.floor(y / 2)) > 0.91)
            light += 14;
    }
    out[0] = toByte(out[0] + light);
    out[1] = toByte(out[1] + light);
    out[2] = toByte(out[2] + light);
    return out;
}

export function buildPlate(name, rows) {
    const { sky, sea, meadow } = PALETTES[name];
    const plate = new Uint8Array(WIDTH * rows * 3);
    const color = [0, 0, 0];
    const grass = [0, 0, 0];
    for (let y = 0; y < rows; y++) {
        const seaRow = y >= HORIZON;
        if (y < HORIZON)
            gradientInto(sky, y / (HORIZON - 1), color);
        else
            gradientInto(sea, (y - HORIZON) / 35, color);

        let offset = y * WIDTH * 3;
        for (let x = 0; x < WIDTH; x++, offset += 3) {
            let light;
            let source = color;
            if (!seaRow) {
                light = (hash(x, y) - 0.5) * 1.14;
            } else if (y < COAST[x]) {
                light = (hash(x, y) - 0.5) * 2.0;
            } else {
                const depth = y - COAST[x];
                gradientInto(meadow, (depth + 5 * Math.sin(x / 55 + depth / 12)) / 78, grass);
                source = grass;
                light = (hash(x, y) - 0.5) * (depth < 12 ? 11 : 3);
                if (depth < 2)
                    light -= 17;
                if (depth < 21 && hash(x, Math.floor(y / 2)) > 0.91)
                    light += 14;
            }
            plate[offset] = toByte(source[0] + light);
            plate[offset + 1] = toByte(source[1] + light);
            plate[offset + 2] = toByte(source[2] + light);
        }
    }
    return plate;
}

function sunPosition(frame) {
    const arc = Math.sin(Math.PI * (frame - 110) / 280);
    const x = 480 - 314 * Math.cos(Math.PI * (frame - 110) / 280);
    const y = arc >= 0 ? HORIZON - 356 * arc ** 1.30 : HORIZON - 472 * arc;
    return { arc, x, y };
}

// Colours and positions the animated layers need for one lighting frame.
// Fully JSON-compatible: sun/moon are [x, y, strength 0..255].
export function lighting(index) {
    const key = index / SKY_KEY_SCALE;
    const [before, after, weight] = keyInterval(SKY_KEYS, key);
    const [firstSun, secondSun, sunWeight] = keyInterval(SUN_COLORS, key);
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const sample = (x, y) => {
        shadePixel(before, x, y, a);
        shadePixel(after, x, y, b);
        return [0, 1, 2].map(c => Math.round(mix(a[c], b[c], weight)));
    };
    const { x: sunX, y: sunY } = sunPosition(key);
    const sunStrength = smooth(clamp(Math.min(key - 99, 401 - key) / 11));
    const moonTime = key >= 410 ? key - 410 : key + 90;
    const moonStrength = smooth(clamp(Math.min(moonTime, 180 - moonTime) / 31));
    return {
        sun: [Math.round(sunX), Math.round(sunY), Math.round(sunStrength * 255)],
        moon: [
            Math.round(147 + 660 * moonTime / 180),
            Math.round(371 - 211 * Math.sin(Math.PI * moonTime / 180)),
            Math.round(moonStrength * 255),
        ],
        sunlight: firstSun.map((value, i) => Math.round(mix(value, secondSun[i], sunWeight))),
        cloud: CLOUD_COLORS[before].map((value, i) => Math.round(mix(value, CLOUD_COLORS[after][i], weight))),
        sea: sample(480, 445),
        grass: sample(480, 512),
        day: Math.round(255 * smooth(clamp(Math.min(key - 81, 419 - key) / 53))),
    };
}

// Smooth palette colours for a frame (no noise): the vertical gradients of the sky, the sea and the
// meadow, for renderers that draw with gradients instead of per-pixel images.
export function skyColors(index) {
    const key = index / SKY_KEY_SCALE;
    const [before, after, weight] = keyInterval(SKY_KEYS, key);
    const blendPart = part => PALETTES[before][part].map((color, i) =>
        color.map((value, channel) => mix(value, PALETTES[after][part][i][channel], weight)));
    return { sky: blendPart('sky'), sea: blendPart('sea'), meadow: blendPart('meadow') };
}

// The sun's position, size and colours. `strength` already includes its fade-in/out at the horizon.
export function sunInfo(index) {
    const key = index / SKY_KEY_SCALE;
    const { arc, x, y } = sunPosition(key);
    const visibility = smooth(clamp(Math.min(key - 99, 401 - key) / 11));
    const [firstSun, secondSun, sunWeight] = keyInterval(SUN_COLORS, key);
    return {
        x, y, arc, visibility,
        sigma: mix(64, 98, Math.max(0, arc)),
        strength: visibility * mix(0.84, 0.70, Math.max(0, arc)),
        glow: firstSun.map((value, i) => mix(value, secondSun[i], sunWeight)),
        disk: [255, 255, Math.round(mix(236, 255, Math.max(0, arc)))],
    };
}

// The visible stars: [x, y, size 0..1, brightness 0..1]. Empty by day.
export function starField(index) {
    const key = index / SKY_KEY_SCALE;
    const nightTime = key >= 410 ? key - 410 : key + 90;
    const visibility = smooth(clamp(Math.min(nightTime, 180 - nightTime) / 31));
    if (nightTime / 180 < 0 || nightTime / 180 > 1 || !visibility)
        return [];
    return STARS.map(([x, y, size, phase]) => [
        x, y, size, (0.19 + 0.62 * size) * (0.83 + 0.17 * Math.sin(TAU * key / 50 + phase)) * visibility,
    ]);
}

// `rows` limits the image to the top rows of the 960x540 scene. The desert
// scenes only need the sky (rows = HORIZON); Coast needs the whole picture.
export function createSky({ rows = HEIGHT } = {}) {
    const plates = new Map();
    const plate = name => {
        if (!plates.has(name))
            plates.set(name, buildPlate(name, rows));
        return plates.get(name);
    };

    function blendPixel(out, x, y, color, opacity) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= rows)
            return;
        const i = (y * WIDTH + x) * 3;
        out[i] = Math.round(mix(out[i], color[0], opacity));
        out[i + 1] = Math.round(mix(out[i + 1], color[1], opacity));
        out[i + 2] = Math.round(mix(out[i + 2], color[2], opacity));
    }

    function drawMoon(out, key) {
        const nightTime = key >= 410 ? key - 410 : key + 90;
        const moonProgress = nightTime / 180;
        if (moonProgress < 0 || moonProgress > 1)
            return;
        const visibility = smooth(clamp(Math.min(nightTime, 180 - nightTime) / 31));
        if (!visibility)
            return;
        const x = 147 + 660 * moonProgress;
        const y = 371 - 211 * Math.sin(Math.PI * moonProgress);
        for (let py = 426; py < 454; py++) {
            const spread = 16 + (py - 426) * 2.3;
            const falloff = 0.16 * visibility * Math.exp(-(py - 426) / 15);
            for (let px = Math.max(0, Math.floor(x - 3 * spread)); px <= Math.min(WIDTH - 1, x + 3 * spread); px++)
                blendPixel(out, px, py, [145, 155, 231], falloff * Math.exp(-0.5 * ((px - x) / spread) ** 2));
        }
        for (const [sx, sy, size, phase] of STARS) {
            const brightness = (0.19 + 0.62 * size) * (0.83 + 0.17 * Math.sin(TAU * key / 50 + phase));
            blendPixel(out, sx, sy, [234, 227, 255], brightness * visibility);
            if (size > 0.85) {
                blendPixel(out, sx + 1, sy, [234, 227, 255], brightness * visibility * 0.4);
                blendPixel(out, sx, sy + 1, [234, 227, 255], brightness * visibility * 0.4);
            }
        }
        for (let py = Math.round(y - 51); py <= Math.round(y + 51); py++) {
            for (let px = Math.round(x - 51); px <= Math.round(x + 51); px++) {
                const dx = px - x;
                const dy = py - y;
                const d = Math.hypot(dx, dy);
                const glow = 0.13 * Math.exp(-d * d / 650);
                const disk = clamp(11.8 - d);
                const shadow = clamp(11.0 - Math.hypot(dx + 5.5, dy + 3.7));
                blendPixel(out, px, py, [187, 148, 250], glow * visibility);
                if (disk > 0)
                    blendPixel(out, px, py, [255, 246, 251], disk * (1 - shadow) * visibility);
            }
        }
    }

    function drawSun(out, key, color) {
        if (key < 99 || key > 401)
            return;
        const { arc, x, y } = sunPosition(key);
        const visibility = smooth(clamp(Math.min(key - 99, 401 - key) / 11));
        const sigma = mix(64, 98, Math.max(0, arc));
        const invVariance = 1 / (2 * sigma * sigma);
        const [red, green, blue] = color;
        const minX = Math.max(0, Math.floor(x - 2.9 * sigma));
        const maxX = Math.min(WIDTH - 1, Math.ceil(x + 2.9 * sigma));
        const minY = Math.max(0, Math.floor(y - 2.9 * sigma));
        const maxY = Math.min(HORIZON - 1, Math.ceil(y + 2.9 * sigma));
        const xGlow = new Float32Array(maxX - minX + 1);
        for (let px = minX; px <= maxX; px++)
            xGlow[px - minX] = Math.exp(-((px - x) ** 2) * invVariance);
        const strength = visibility * mix(0.84, 0.70, Math.max(0, arc));
        for (let py = minY; py <= maxY; py++) {
            const strengthAtY = strength * Math.exp(-((py - y) ** 2) * invVariance);
            for (let px = minX; px <= maxX; px++) {
                const opacity = strengthAtY * xGlow[px - minX];
                const i = (py * WIDTH + px) * 3;
                out[i] = Math.round(mix(out[i], red, opacity));
                out[i + 1] = Math.round(mix(out[i + 1], green, opacity));
                out[i + 2] = Math.round(mix(out[i + 2], blue, opacity));
            }
        }
        const disk = [255, 255, Math.round(mix(236, 255, Math.max(0, arc)))];
        for (let py = Math.max(0, Math.floor(y - 16)); py < Math.min(HORIZON, y + 16); py++) {
            for (let px = Math.floor(x - 16); px < x + 16; px++) {
                const opacity = clamp(15.4 - Math.hypot(px - x, py - y)) * visibility;
                if (opacity)
                    blendPixel(out, px, py, disk, opacity);
            }
        }
        const reflection = clamp(1 - Math.abs(arc) * 3.7) * visibility * 0.5;
        if (reflection > 0) {
            for (let py = HORIZON; py < 451; py++) {
                const spread = 31 + (py - HORIZON) * 3.4;
                const intensity = reflection * Math.exp(-(py - HORIZON) / 12);
                for (let px = Math.max(0, Math.floor(x - spread * 2)); px <= Math.min(WIDTH - 1, x + spread * 2); px++)
                    blendPixel(out, px, py, color, intensity * Math.exp(-0.5 * ((px - x) / spread) ** 2));
            }
        }
    }

    return {
        rows,
        byteLength: WIDTH * rows * 3,

        // Fill `out` (RGB, WIDTH*rows*3 bytes) with the sky for lighting frame `index`.
        renderFrame(index, out) {
            const key = index / SKY_KEY_SCALE;
            const [before, after, weight] = keyInterval(SKY_KEYS, key);
            const a = plate(before);
            const b = plate(after);
            if (weight === 0) {
                out.set(a);
            } else {
                for (let i = 0; i < out.length; i++)
                    out[i] = Math.round(a[i] + (b[i] - a[i]) * weight);
            }

            const [firstSun, secondSun, sunWeight] = keyInterval(SUN_COLORS, key);
            const sunlight = firstSun.map((value, i) => mix(value, secondSun[i], sunWeight));
            const dawn = clamp(1 - Math.abs(key - 90) / 8) * (0.82 + (key - 90) * 0.021);
            const dusk = clamp(1 - Math.abs(key - 410) / 8) * (0.82 + (410 - key) * 0.021);
            if (dawn > 0 || dusk > 0) {
                const center = dawn > 0 ? 201 : 757;
                const tint = dawn > 0 ? [223, 105, 157] : [128, 93, 208];
                const strength = Math.max(dawn, dusk) * 0.076;
                for (let y = 307; y < HORIZON; y++) {
                    const vertical = ((y - 307) / (HORIZON - 307)) ** 1.7;
                    for (let x = 0; x < WIDTH; x++)
                        blendPixel(out, x, y, tint, strength * vertical * Math.exp(-((x - center) ** 2) / (2 * 291 ** 2)));
                }
            }
            drawSun(out, key, sunlight);
            drawMoon(out, key);
            return out;
        },
    };
}
