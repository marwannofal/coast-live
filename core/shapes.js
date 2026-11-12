// SPDX-License-Identifier: GPL-2.0-or-later
// Procedural shapes: the coastline and the two cloud banks.
import { WIDTH } from './config.js';
import { clamp, hash } from './math.js';

// Shoreline height for every pixel column of the 960 px wide scene.
export const COAST = Array.from({ length: WIDTH }, (_, x) => Math.round(
    461 + 2.2 * Math.sin(x / 38) + 1.7 * Math.sin(x / 16)
        + 1.5 * Math.sin(x / 7.1) - 4.5 * hash(Math.floor(x / 2), 11) ** 3,
));

// The same shoreline sampled every second column (used by the water clip path).
export const COAST_HALF = Array.from({ length: WIDTH / 2 + 1 }, (_, x) => COAST[Math.min(x * 2, WIDTH - 1)]);

// A cloud mask is stored as run-length spans grouped by tone: { w, h, groups },
// where groups[tone] is a list of [x, y, length] spans.
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

export function makeCloudMasks() {
    return [
        cloudMask(174, 93, [
            [49, 60, 37, 18], [35, 48, 24, 19], [64, 40, 30, 25],
            [88, 47, 27, 24], [109, 61, 28, 15], [133, 64, 24, 8], [150, 52, 10, 4],
        ]),
        cloudMask(165, 89, [
            [32, 66, 23, 10], [52, 59, 29, 16], [69, 45, 25, 23],
            [87, 54, 29, 21], [112, 61, 24, 12], [145, 45, 11, 5],
        ]),
    ];
}
