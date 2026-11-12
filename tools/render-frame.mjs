// Render one lighting frame to raw RGB on stdout.
// Usage: node tools/render-frame.mjs FRAME [ROWS]   (ROWS defaults to 540)
import { createSky } from '../core/sky.js';
const frame = Number(process.argv[2] ?? 0);
const rows = Number(process.argv[3] ?? 540);
const sky = createSky({ rows });
process.stdout.write(sky.renderFrame(frame, new Uint8Array(sky.byteLength)));
