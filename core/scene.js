// SPDX-License-Identifier: GPL-2.0-or-later
// Animated Coast layers: clouds, water ripples and grass. Every function draws
// through a small `paint` object (color, rectangle, fill, save, restore, moveTo,
// lineTo, close, clip), so the same code runs on Cairo, QML Canvas or any other
// 2D backend.
import { HORIZON, WIDTH } from './config.js';
import { TAU, blend, clamp, mix, seededRandom, wrap } from './math.js';

const MOONLIGHT = [174, 191, 249];

const random = seededRandom(2317);

export const CLOUDS = [
    { bank: 1, x: 680, y: 230, scale: 0.67, speed: 2.5, opacity: 0.39 },
    { bank: 0, x: 23, y: 306, scale: 0.65, speed: 4.3, opacity: 0.53 },
    { bank: 0, x: 250, y: 279, scale: 1.07, speed: 7.5, opacity: 0.94 },
    { bank: 1, x: 544, y: 292, scale: 0.91, speed: 5.9, opacity: 0.81 },
];

export function cloudPosition(cloud, elapsed) {
    const drift = 6 * Math.sin(elapsed * 0.13 + cloud.x);
    return [
        wrap(cloud.x + 215 + elapsed * cloud.speed + drift, WIDTH + 215) - 215,
        cloud.y + 3 * Math.sin(elapsed * 0.31 + cloud.x),
    ];
}

export function paintCloud(paint, mask, cloud, light, x, y) {
    const distance = Math.hypot(x + mask.w * cloud.scale / 2 - light.sun[0], y + 36 - light.sun[1]);
    const sun = light.sun[2] / 255 * Math.exp(-(distance ** 2) / (2 * 154 ** 2));
    const moonDistance = Math.hypot(x + mask.w * cloud.scale / 2 - light.moon[0], y + 36 - light.moon[1]);
    const moon = light.moon[2] / 255 * Math.exp(-(moonDistance ** 2) / (2 * 155 ** 2));
    const base = blend(blend(light.cloud, light.sunlight, sun * 0.4), MOONLIGHT, moon * 0.22);
    for (const [tone, spans] of mask.groups.entries()) {
        if (!spans.length)
            continue;

        const opacity = Math.floor(tone / 5) / 6 * cloud.opacity;
        const shade = 0.71 + (tone % 5) * 0.073;
        paint.color(base.map(c => c * shade), opacity);
        for (const [sx, sy, length] of spans)
            paint.rectangle(sx, sy, length, 1);
        paint.fill();
    }
}

const ripples = Array.from({ length: 166 }, () => ({
    x: random() * WIDTH,
    offset: random(),
    speed: 0.11 + 0.16 * random(),
    drift: random() * 8 - 4,
    length: 3 + 40 * random() ** 2,
    shape: random() * TAU,
}));

export const RIPPLES = ripples;
export const CREST_COUNT = 7;

export function waterColors(light) {
    const day = light.day / 255;
    return {
        day,
        glow: blend([124, 153, 224], [214, 247, 255], day),
        dark: blend(light.sea, [22, 31, 65], 0.62),
    };
}

// Position, fade and colour of one wave crest line.
export function crestAt(crest, elapsed) {
    const phase = wrap(elapsed * 0.19 + crest / 7, 1);
    const depth = phase ** 1.8;
    return { depth, baseY: 427 + depth * 38, fade: Math.sin(phase * Math.PI) * (0.36 + depth * 0.64) };
}

// Everything needed to draw one ripple: a short horizontal line that appears, drifts and fades.
export function rippleAt(ripple, elapsed, light, colors) {
    const phase = wrap(elapsed * ripple.speed + ripple.offset, 1);
    const depth = phase ** 1.67;
    const x = Math.floor(wrap(ripple.x + elapsed * ripple.drift + 23, WIDTH + 46) - 23);
    const y = Math.round(427 + depth * 36 + Math.sin(x * 0.017 + ripple.shape) * depth * 2.3);
    const width = Math.ceil(ripple.length * (0.38 + depth * 0.81));
    const strength = Math.sin(phase * Math.PI) ** 1.4;
    const center = x + width / 2;
    const sunDx = (center - light.sun[0]) / (18 + depth * 91);
    const moonDx = (center - light.moon[0]) / (15 + depth * 57);
    const lowSun = 0.16 + 0.84 * clamp((light.sun[1] - 95) / 310);
    const sun = light.sun[2] / 255 * Math.exp(-0.5 * sunDx ** 2) * lowSun;
    const moon = light.moon[2] / 255 * Math.exp(-0.5 * moonDx ** 2);
    return {
        x, y, width, depth,
        shadowAlpha: strength * (0.11 + depth * 0.13),
        reflection: blend(blend(colors.glow, light.sunlight, sun * 0.93), MOONLIGHT, moon * 0.76),
        alpha: strength * Math.min(0.76, 0.19 + colors.day * 0.08 + sun * 0.54 + moon * 0.43),
    };
}

export function paintWater(paint, elapsed, light, coast) {
    const colors = waterColors(light);
    const dark = colors.dark;
    paint.save();
    paint.moveTo(0, HORIZON + 3);
    paint.lineTo(WIDTH, HORIZON + 3);
    for (let i = coast.length - 1; i >= 0; i--)
        paint.lineTo(i * 2, coast[i] - 1);
    paint.close();
    paint.clip();

    for (let crest = 0; crest < CREST_COUNT; crest++) {
        const { depth, baseY, fade } = crestAt(crest, elapsed);
        paint.color(dark, fade * 0.21);
        for (let x = 0; x < WIDTH; x += 8) {
            const swell = Math.sin(x * 0.022 + crest * 1.7 + elapsed * 0.73);
            const cross = Math.sin(x * 0.009 - elapsed * 0.51 + crest);
            if (cross > -0.15)
                paint.rectangle(x, Math.round(baseY + (swell + cross) * depth), 8, 1);
        }
        paint.fill();
    }

    for (const ripple of ripples) {
        const { x, y, width, depth, shadowAlpha, reflection, alpha } = rippleAt(ripple, elapsed, light, colors);
        paint.color(dark, shadowAlpha);
        paint.rectangle(x + 1, y + 1, width + 2, 1);
        paint.fill();
        paint.color(reflection, alpha);
        paint.rectangle(x, y, width, 1);
        if (depth > 0.63 && width > 14)
            paint.rectangle(x + Math.round(width * 0.36), y - 1, Math.round(width * 0.30), 1);
        paint.fill();
    }

    paint.restore();
}

const grassTufts = Array.from({ length: 107 }, (_, i) => {
    const x = Math.round(i * WIDTH / 107 + random() * 23 - 10);
    const depth = random() ** 1.65;
    const y = Math.round(469 + depth * 74);
    const size = 0.39 + depth * 0.73;
    const blades = Array.from({ length: 3 + Math.floor(random() * 5) }, () => ({
        height: Math.ceil((6 + random() * 16) * size),
        offset: (random() - 0.5) * 9 * size,
        curve: (random() - 0.31) * 0.65,
        tone: Math.floor(random() * 3),
    }));
    return { x, y, size, blades };
}).sort((a, b) => a.y - b.y);

export const GRASS_TUFTS = grassTufts;

// The three blade tones for the current light.
export function grassTones(light) {
    const day = light.day / 255;
    const sun = light.sun[2] / 255;
    const moon = light.moon[2] / 255;
    const hue = blend(blend(light.grass, light.sunlight, sun * (0.16 + day * 0.07)), MOONLIGHT, moon * 0.13);
    return [
        blend(light.grass, [17, 25, 12], 0.62),
        hue.map((c, i) => Math.min(255, c + [21, 34, 5][i] * (0.43 + 0.57 * day))),
        hue.map((c, i) => Math.min(255, c + [46, 58, 10][i] * (0.39 + 0.61 * day))),
    ];
}

export const tuftWind = (tuft, elapsed) => 0.29 + 0.51 * Math.sin(elapsed * 1.56 - tuft.x * 0.012)
    + 0.21 * Math.sin(elapsed * 3.02 + tuft.x * 0.023 + tuft.y * 0.08);

// Draw one tuft (all three tones) with a given wind value. Used to make per-tuft sprites.
export function paintTuft(paint, tuft, tones, wind) {
    for (let tone = 0; tone < 3; tone++) {
        paint.color(tones[tone], tone === 0 ? 0.49 : 0.76);
        for (const blade of tuft.blades) {
            if (blade.tone !== tone)
                continue;
            const root = tuft.x + blade.offset;
            let previousX = Math.round(root);
            for (let rise = 0; rise < blade.height; rise++) {
                const progress = rise / blade.height;
                const bend = blade.height * (blade.curve * progress + wind * progress ** 2);
                const x = Math.round(root + bend);
                const width = Math.max(1, Math.round(2.7 * tuft.size * (1 - progress)));
                paint.rectangle(Math.min(previousX, x), tuft.y - rise, width + Math.abs(x - previousX), 1);
                previousX = x;
            }
        }
        paint.fill();
    }
}

export function paintGrass(paint, elapsed, light) {
    const day = light.day / 255;
    const sun = light.sun[2] / 255;
    const moon = light.moon[2] / 255;
    const hue = blend(blend(light.grass, light.sunlight, sun * (0.16 + day * 0.07)), MOONLIGHT, moon * 0.13);
    const tones = [
        blend(light.grass, [17, 25, 12], 0.62),
        hue.map((c, i) => Math.min(255, c + [21, 34, 5][i] * (0.43 + 0.57 * day))),
        hue.map((c, i) => Math.min(255, c + [46, 58, 10][i] * (0.39 + 0.61 * day))),
    ];
    for (let tone = 0; tone < tones.length; tone++) {
        paint.color(tones[tone], tone === 0 ? 0.49 : 0.76);
        for (const tuft of grassTufts) {
            const wind = 0.29 + 0.51 * Math.sin(elapsed * 1.56 - tuft.x * 0.012)
                + 0.21 * Math.sin(elapsed * 3.02 + tuft.x * 0.023 + tuft.y * 0.08);
            for (const blade of tuft.blades) {
                if (blade.tone !== tone)
                    continue;
                const root = tuft.x + blade.offset;
                let previousX = Math.round(root);
                for (let rise = 0; rise < blade.height; rise++) {
                    const progress = rise / blade.height;
                    const bend = blade.height * (blade.curve * progress + wind * progress ** 2);
                    const x = Math.round(root + bend);
                    const width = Math.max(1, Math.round(2.7 * tuft.size * (1 - progress)));
                    paint.rectangle(Math.min(previousX, x), tuft.y - rise, width + Math.abs(x - previousX), 1);
                    previousX = x;
                }
            }
        }
        paint.fill();
    }
}
