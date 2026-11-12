// Verifies the new procedural sky against the data the original generator produced.
// Usage: node tests/sky-vs-legacy.mjs /path/to/old-scene-data.json
import fs from 'node:fs';
import { createSky, lighting, shadePixel, PALETTES } from '../core/sky.js';
import { makeCloudMasks, COAST_HALF } from '../core/shapes.js';
import { WIDTH, HEIGHT } from '../core/config.js';

const old = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let bad = 0;
for (let i = 0; i < 2000; i++) {
    if (JSON.stringify(lighting(i)) !== JSON.stringify(old.frames[i])) { if (bad++ < 3) console.log('light mismatch', i, lighting(i), old.frames[i]); }
}
console.log('lighting frames identical:', bad === 0, `(${bad} mismatches)`);
console.log('cloud masks identical:', JSON.stringify(makeCloudMasks()) === JSON.stringify(old.clouds));
console.log('coast identical:', JSON.stringify(COAST_HALF) === JSON.stringify(old.coast));

// fast plate builder == reference per-pixel formula (no overlays involved)
import { buildPlate } from '../core/sky.js';
const px = [0, 0, 0]; let diffs = 0;
for (const name of Object.keys(PALETTES)) {
    const plate = buildPlate(name, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        shadePixel(name, x, y, px);
        const i = (y * WIDTH + x) * 3;
        if (px[0] !== plate[i] || px[1] !== plate[i + 1] || px[2] !== plate[i + 2]) diffs++;
    }
}
console.log('all 7 plates match the reference pixel formula:', diffs === 0, `(${diffs} diffs)`);
