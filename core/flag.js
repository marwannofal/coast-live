// SPDX-License-Identifier: GPL-2.0-or-later
// The waving Jordanian flag on the Amman scene's flagpole, drawn one pixel column at a time through the same
// `paint` interface as everything else (rectangles + fill), so every platform can share the shape.
import { clamp } from './math.js';

// Where the flag hangs: top-left of its hoist (just right of the pole top in the Amman art), in scene pixels.
export const FLAG = { x: 631, y: 201, width: 44, height: 24, amplitude: 3.2 };

const BLACK = [18, 18, 18], WHITE = [244, 244, 240], GREEN = [24, 120, 58], RED = [196, 32, 38];
const STAR = [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1], [-2, 0], [2, 0]];
const STAR_X = 8;

// Vertical shift of column x (0 at the pole, growing towards the free end), in pixels.
export function flagWave(x, elapsed) {
    const t = x / (FLAG.width - 1);
    return Math.round(Math.sin(elapsed * 2.6 - x * 0.31) * FLAG.amplitude * t * (0.4 + 0.6 * t)
        + Math.sin(elapsed * 1.3 + 1.1) * 0.8 * t);
}

// Daylight and dusk shading of the cloth, in the same spirit as the terrain tint.
export function flagTint(light) {
    const day = clamp(light.day / 255);
    const k = 0.34 + 0.66 * day;
    return [k * 0.96, k * 0.97, Math.min(1.15, k * 1.12)];
}

export function flagColors(light) {
    const tint = flagTint(light);
    const shade = c => c.map((value, i) => Math.min(255, value * tint[i]));
    return { black: shade(BLACK), white: shade(WHITE), green: shade(GREEN), red: shade(RED) };
}

// The static shape of each pixel column: the red chevron's [top, height] (relative to the flag's top) and the
// star's pixel rows. Only the vertical position of a column changes while the flag waves.
export const FLAG_COLUMNS = Array.from({ length: FLAG.width }, (_, x) => {
    const reach = Math.round(FLAG.height / 2 * (1 - x / (FLAG.width / 2)));
    return {
        red: reach > 0 ? [FLAG.height / 2 - reach, 2 * reach] : null,
        star: STAR.filter(([dx]) => x === STAR_X + dx).map(([, dy]) => FLAG.height / 2 + dy),
    };
});

export function paintFlag(paint, elapsed, light) {
    const { x: fx, y: fy, width, height } = FLAG;
    const colors = flagColors(light);
    const stripe = height / 3;
    const waves = Array.from({ length: width }, (_, x) => fy + flagWave(x, elapsed));
    const batch = (color, rects) => {
        paint.color(color, 1);
        for (const [x, y, w, h] of rects)
            paint.rectangle(x, y, w, h);
        paint.fill();
    };
    const band = (from, to) => waves.map((y, x) => [fx + x, y + from, 1, to - from]);
    batch(colors.black, band(0, stripe));
    batch(colors.white, band(stripe, 2 * stripe));
    batch(colors.green, band(2 * stripe, height));
    batch(colors.red, FLAG_COLUMNS.flatMap((c, x) => c.red ? [[fx + x, waves[x] + c.red[0], 1, c.red[1]]] : []));
    batch(colors.white, FLAG_COLUMNS.flatMap((c, x) => c.star.map(y => [fx + x, waves[x] + y, 1, 1])));
}
