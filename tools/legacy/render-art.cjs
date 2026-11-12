// SPDX-License-Identifier: GPL-2.0-or-later
const fs = require('node:fs');
const { once } = require('node:events');

const width = 960;
const height = 540;
const horizon = 424;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (t) => Math.max(0, Math.min(1, t));
const smooth = (t) => t * t * (3 - 2 * t);
const cycle = 2 * Math.PI;
const originalNames = ['night', 'sunrise', 'morning', 'noon', 'evening', 'sunset', 'blue-hour'];
const palette = {
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

function hash(x, y) {
    let value = Math.imul(x + 197, 374761393) ^ Math.imul(y + 911, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

const coast = Array.from({ length: width }, (_, x) => Math.round(
    461 + 2.2 * Math.sin(x / 38) + 1.7 * Math.sin(x / 16)
        + 1.5 * Math.sin(x / 7.1) - 4.5 * hash(Math.floor(x / 2), 11) ** 3,
));

function gradient(colors, position) {
    const phase = clamp(position) * (colors.length - 1);
    const step = Math.min(colors.length - 2, Math.floor(phase));
    return colors[step].map((channel, i) => mix(channel, colors[step + 1][i], phase - step));
}

function makePlate(name) {
    const { sky, sea, meadow } = palette[name];
    const plate = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        const skyShade = gradient(sky, y / (horizon - 1));
        const seaShade = gradient(sea, (y - horizon) / 35);
        for (let x = 0; x < width; x++) {
            let color;
            let light;
            if (y < horizon) {
                color = skyShade;
                light = (hash(x, y) - 0.5) * 1.14;
            } else if (y < coast[x]) {
                color = seaShade;
                light = (hash(x, y) - 0.5) * 2.0;
            } else {
                const depth = y - coast[x];
                color = gradient(meadow, (depth + 5 * Math.sin(x / 55 + depth / 12)) / 78);
                light = (hash(x, y) - 0.5) * (depth < 12 ? 11 : 3);
                if (depth < 2)
                    light -= 17;
                if (depth < 21 && hash(x, Math.floor(y / 2)) > 0.91)
                    light += 14;
            }
            const offset = (y * width + x) * 3;
            for (let c = 0; c < 3; c++)
                plate[offset + c] = Math.round(clamp((color[c] + light) / 255) * 255);
        }
    }
    return plate;
}

const plates = Object.fromEntries(originalNames.map(name => [name, makePlate(name)]));

function cloudMask(w, h, lobes) {
    const groups = Array.from({ length: 35 }, () => []);
    for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
            let contour = 4;
            let inner = 4;
            const px = Math.floor(x / 2) * 2 + 1;
            const py = Math.floor(y / 2) * 2 + 1;
            for (const [cx, cy, rx, ry] of lobes) {
                const radial = Math.hypot((px - cx) / rx, (py - cy) / ry);
                contour = Math.min(contour, radial);
                inner = Math.min(inner, Math.hypot((px - cx + 3) / rx, (py - cy + 5) / ry));
            }
            if (contour >= 1.035) {
                row.push(0);
                continue;
            }
            const fade = clamp((1.035 - contour) / 0.14);
            const floor = clamp((h - py) / 28);
            const opacity = Math.round(5 * fade * (0.55 + 0.45 * floor));
            const tone = Math.round(4 * clamp(0.88 - py / h * 0.52 + (contour - inner) * 1.85));
            row.push(opacity ? opacity * 5 + tone : 0);
        }
        for (let x = 0; x < w;) {
            const tone = row[x];
            let run = 1;
            while (x + run < w && row[x + run] === tone)
                run++;
            if (tone)
                groups[tone].push([x, y, run]);
            x += run;
        }
    }
    return { w, h, groups };
}

function masks() {
    const clouds = [
        cloudMask(174, 93, [
            [49, 60, 37, 18], [35, 48, 24, 19], [64, 40, 30, 25],
            [88, 47, 27, 24], [109, 61, 28, 15], [133, 64, 24, 8], [150, 52, 10, 4],
        ]),
        cloudMask(165, 89, [
            [32, 66, 23, 10], [52, 59, 29, 16], [69, 45, 25, 23],
            [87, 54, 29, 21], [112, 61, 24, 12], [145, 45, 11, 5],
        ]),
    ];
    return {
        clouds,
        coast: Array.from({ length: 481 }, (_, x) => coast[Math.min(x * 2, width - 1)]),
    };
}

const skyKeys = [
    [0, 'night'], [63, 'night'], [90, 'blue-hour'], [110, 'sunrise'],
    [173, 'morning'], [250, 'noon'], [328, 'evening'], [390, 'sunset'],
    [410, 'blue-hour'], [452, 'night'], [500, 'night'],
];
const sunColors = [
    [110, [255, 229, 152]], [173, [221, 250, 255]], [250, [231, 252, 255]],
    [328, [255, 218, 193]], [390, [255, 196, 99]],
];
const cloudColors = {
    night: [111, 52, 108], 'blue-hour': [130, 63, 143], sunrise: [255, 140, 185],
    morning: [247, 204, 255], noon: [229, 245, 255], evening: [252, 186, 216],
    sunset: [245, 97, 81],
};

function keyInterval(keys, frame) {
    const index = keys.findIndex(([point]) => frame < point);
    if (index < 0) return [keys.at(-1)[1], keys.at(-1)[1], 0];
    if (index === 0) return [keys[0][1], keys[0][1], 0];
    const [from, before] = keys[index - 1];
    const [to, after] = keys[index];
    return [before, after, smooth((frame - from) / (to - from))];
}

let seed = 137;
function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
}
const stars = Array.from({ length: 28 }, () => [
    Math.floor(18 + random() * 925), Math.floor(17 + random() * 290),
    random(), random() * cycle,
]);

const pixels = Buffer.allocUnsafe(width * height * 3);
function blendPixel(x, y, color, opacity) {
    const i = (y * width + x) * 3;
    for (let c = 0; c < 3; c++) {
        pixels[i + c] = Math.round(mix(pixels[i + c], color[c], opacity));
    }
}

function drawMoon(frame) {
    const nightTime = frame >= 410 ? frame - 410 : frame + 90;
    const moonProgress = nightTime / 180;
    if (moonProgress < 0 || moonProgress > 1) return;
    const visibility = smooth(clamp(Math.min(nightTime, 180 - nightTime) / 31));
    if (!visibility) return;
    const x = 147 + 660 * moonProgress;
    const y = 371 - 211 * Math.sin(Math.PI * moonProgress);
    for (let py = 426; py < 454; py++) {
        const spread = 16 + (py - 426) * 2.3;
        const falloff = 0.16 * visibility * Math.exp(-(py - 426) / 15);
        for (let px = Math.max(0, Math.floor(x - 3 * spread)); px <= Math.min(width - 1, x + 3 * spread); px++) {
            blendPixel(px, py, [145, 155, 231], falloff * Math.exp(-0.5 * ((px - x) / spread) ** 2));
        }
    }
    for (const [sx, sy, size, phase] of stars) {
        const brightness = (0.19 + 0.62 * size) * (0.83 + 0.17 * Math.sin(cycle * frame / 50 + phase));
        blendPixel(sx, sy, [234, 227, 255], brightness * visibility);
        if (size > 0.85) {
            blendPixel(sx + 1, sy, [234, 227, 255], brightness * visibility * 0.4);
            blendPixel(sx, sy + 1, [234, 227, 255], brightness * visibility * 0.4);
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
            blendPixel(px, py, [187, 148, 250], glow * visibility);
            if (disk > 0) {
                blendPixel(px, py, [255, 246, 251], disk * (1 - shadow) * visibility);
            }
        }
    }
}

function drawSun(frame, color) {
    if (frame < 99 || frame > 401) return;
    const progress = (frame - 110) / 280;
    const angle = Math.PI * progress;
    const arc = Math.sin(angle);
    const x = 480 - 314 * Math.cos(angle);
    const y = arc >= 0 ? horizon - 356 * arc ** 1.30 : horizon - 472 * arc;
    const visibility = smooth(clamp(Math.min(frame - 99, 401 - frame) / 11));
    const sigma = mix(64, 98, Math.max(0, arc));
    const invVariance = 1 / (2 * sigma * sigma);
    const [red, green, blue] = color;
    const minX = Math.max(0, Math.floor(x - 2.9 * sigma));
    const maxX = Math.min(width - 1, Math.ceil(x + 2.9 * sigma));
    const minY = Math.max(0, Math.floor(y - 2.9 * sigma));
    const maxY = Math.min(horizon - 1, Math.ceil(y + 2.9 * sigma));
    const xGlow = new Float32Array(maxX - minX + 1);
    for (let px = minX; px <= maxX; px++) {
        xGlow[px - minX] = Math.exp(-((px - x) ** 2) * invVariance);
    }
    const strength = visibility * mix(0.84, 0.70, Math.max(0, arc));
    for (let py = minY; py <= maxY; py++) {
        const strengthAtY = strength * Math.exp(-((py - y) ** 2) * invVariance);
        for (let px = minX; px <= maxX; px++) {
            const opacity = strengthAtY * xGlow[px - minX];
            const i = (py * width + px) * 3;
            pixels[i] = Math.round(mix(pixels[i], red, opacity));
            pixels[i + 1] = Math.round(mix(pixels[i + 1], green, opacity));
            pixels[i + 2] = Math.round(mix(pixels[i + 2], blue, opacity));
        }
    }
    const disk = [255, 255, Math.round(mix(236, 255, Math.max(0, arc)))];
    for (let py = Math.max(0, Math.floor(y - 16)); py < Math.min(horizon, y + 16); py++) {
        for (let px = Math.floor(x - 16); px < x + 16; px++) {
            const opacity = clamp(15.4 - Math.hypot(px - x, py - y)) * visibility;
            if (opacity) blendPixel(px, py, disk, opacity);
        }
    }
    const reflection = clamp(1 - Math.abs(arc) * 3.7) * visibility * 0.5;
    if (reflection > 0) {
        for (let py = horizon; py < 451; py++) {
            const spread = 31 + (py - horizon) * 3.4;
            const intensity = reflection * Math.exp(-(py - horizon) / 12);
            for (let px = Math.max(0, Math.floor(x - spread * 2)); px <= Math.min(width - 1, x + spread * 2); px++) {
                blendPixel(px, py, color, intensity * Math.exp(-0.5 * ((px - x) / spread) ** 2));
            }
        }
    }
}

function render(frame) {
    const [before, after, weight] = keyInterval(skyKeys, frame);
    const a = plates[before];
    const b = plates[after];
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = Math.round(mix(a[i], b[i], weight));
    }
    const [firstSun, secondSun, sunWeight] = keyInterval(sunColors, frame);
    const sunlight = firstSun.map((value, i) => mix(value, secondSun[i], sunWeight));
    const dawn = clamp(1 - Math.abs(frame - 90) / 8) * (0.82 + (frame - 90) * 0.021);
    const dusk = clamp(1 - Math.abs(frame - 410) / 8) * (0.82 + (410 - frame) * 0.021);
    if (dawn > 0 || dusk > 0) {
        const center = dawn > 0 ? 201 : 757;
        const tint = dawn > 0 ? [223, 105, 157] : [128, 93, 208];
        const strength = Math.max(dawn, dusk) * 0.076;
        for (let y = 307; y < horizon; y++) {
            const vertical = ((y - 307) / (horizon - 307)) ** 1.7;
            for (let x = 0; x < width; x++) {
                const opacity = strength * vertical * Math.exp(-((x - center) ** 2) / (2 * 291 ** 2));
                blendPixel(x, y, tint, opacity);
            }
        }
    }
    drawSun(frame, sunlight);
    drawMoon(frame);

}

function lighting(frame) {
    const [before, after, weight] = keyInterval(skyKeys, frame);
    const a = plates[before];
    const b = plates[after];
    const [firstSun, secondSun, sunWeight] = keyInterval(sunColors, frame);
    const sample = (x, y) => [0, 1, 2].map(c => {
        const index = (y * width + x) * 3 + c;
        return Math.round(mix(a[index], b[index], weight));
    });
    const arc = Math.sin(Math.PI * (frame - 110) / 280);
    const sunStrength = smooth(clamp(Math.min(frame - 99, 401 - frame) / 11));
    const sun = [
        Math.round(480 - 314 * Math.cos(Math.PI * (frame - 110) / 280)),
        Math.round(arc >= 0 ? horizon - 356 * arc ** 1.30 : horizon - 472 * arc),
        Math.round(sunStrength * 255),
    ];
    const moonTime = frame >= 410 ? frame - 410 : frame + 90;
    const moonStrength = smooth(clamp(Math.min(moonTime, 180 - moonTime) / 31));
    const moon = [
        Math.round(147 + 660 * moonTime / 180),
        Math.round(371 - 211 * Math.sin(Math.PI * moonTime / 180)),
        Math.round(moonStrength * 255),
    ];
    return {
        sun, moon,
        sunlight: firstSun.map((value, i) => Math.round(mix(value, secondSun[i], sunWeight))),
        cloud: cloudColors[before].map((value, i) => Math.round(mix(value, cloudColors[after][i], weight))),
        sea: sample(480, 445),
        grass: sample(480, 512),
        day: Math.round(255 * smooth(clamp(Math.min(frame - 81, 419 - frame) / 53))),
    };
}

async function main() {
    if (process.argv[2] && process.argv[2] !== '-') {
        const frames = Array.from({length: 2000}, (_, frame) => lighting(frame / 4));
        fs.writeFileSync(process.argv[2], JSON.stringify({frames, ...masks()}));
    }
    const start = Number(process.argv[3] ?? 0);
    const end = Number(process.argv[4] ?? 2000);
    for (let frame = start; frame < end; frame++) {
        render(frame / 4);
        if (!process.stdout.write(pixels)) await once(process.stdout, 'drain');
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
