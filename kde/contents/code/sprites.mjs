// SPDX-License-Identifier: GPL-2.0-or-later
// Small images for the QML scene, made in plain JavaScript and handed to Qt as PNG data URLs.
//
// Why: QML's Canvas is far too slow for per-pixel work (see README, "KDE status"), but Qt decodes PNGs
// quickly. Sprites are tiny and only rebuilt when the lighting changes, never every frame; QML then
// moves, rotates and fades them on the GPU.
import { COAST } from './shapes.mjs';

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c;
    }
    return table;
})();

function crc32(bytes, start, end) {
    let c = -1;
    for (let i = start; i < end; i++)
        c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function adler32(bytes) {
    let a = 1, b = 0;
    for (let i = 0; i < bytes.length; i++) {
        a = (a + bytes[i]) % 65521;
        b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
}

function put32(out, offset, value) {
    out[offset] = (value >>> 24) & 255;
    out[offset + 1] = (value >>> 16) & 255;
    out[offset + 2] = (value >>> 8) & 255;
    out[offset + 3] = value & 255;
}

function chunk(out, offset, type, data) {
    put32(out, offset, data.length);
    for (let i = 0; i < 4; i++)
        out[offset + 4 + i] = type.charCodeAt(i);
    out.set(data, offset + 8);
    put32(out, offset + 8 + data.length, crc32(out, offset + 4, offset + 8 + data.length));
    return offset + 12 + data.length;
}

// Straight-alpha RGBA (w*h*4 bytes) -> PNG bytes, using uncompressed (stored) deflate blocks.
export function encodePng(rgba, w, h) {
    const rowLength = w * 4 + 1;
    const raw = new Uint8Array(rowLength * h);
    for (let y = 0; y < h; y++)
        raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * rowLength + 1);

    const blocks = Math.ceil(raw.length / 65535);
    const zlib = new Uint8Array(2 + raw.length + blocks * 5 + 4);
    zlib[0] = 0x78;
    zlib[1] = 0x01;
    let o = 2;
    for (let b = 0; b < blocks; b++) {
        const start = b * 65535;
        const length = Math.min(65535, raw.length - start);
        zlib[o++] = b === blocks - 1 ? 1 : 0;
        zlib[o++] = length & 255; zlib[o++] = length >> 8;
        zlib[o++] = ~length & 255; zlib[o++] = (~length >> 8) & 255;
        zlib.set(raw.subarray(start, start + length), o);
        o += length;
    }
    put32(zlib, o, adler32(raw));

    const header = new Uint8Array(13);
    put32(header, 0, w);
    put32(header, 4, h);
    header[8] = 8;    // bit depth
    header[9] = 6;    // RGBA
    const png = new Uint8Array(8 + 25 + 12 + zlib.length + 12);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    let p = chunk(png, 8, 'IHDR', header);
    p = chunk(png, p, 'IDAT', zlib);
    chunk(png, p, 'IEND', new Uint8Array(0));
    return png;
}

const B64 = (() => {
    const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const pairs = new Array(4096);
    for (let i = 0; i < 4096; i++)
        pairs[i] = a[i >> 6] + a[i & 63];
    return pairs;
})();

export function base64(bytes) {
    const n = bytes.length;
    const parts = [];
    let chunkParts = [];
    let i = 0;
    for (; i + 2 < n; i += 3) {
        const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        chunkParts.push(B64[v >> 12] + B64[v & 4095]);
        if (chunkParts.length === 4096) {
            parts.push(chunkParts.join(''));
            chunkParts = [];
        }
    }
    if (i < n) {
        const v = (bytes[i] << 16) | ((i + 1 < n ? bytes[i + 1] : 0) << 8);
        const s = B64[v >> 12] + B64[v & 4095];
        chunkParts.push(i + 1 < n ? s.slice(0, 3) + '=' : s.slice(0, 2) + '==');
    }
    parts.push(chunkParts.join(''));
    return parts.join('');
}

export const pngUrl = (rgba, w, h) => 'data:image/png;base64,' + base64(encodePng(rgba, w, h));

// Straight-alpha "source over" for one pixel of an RGBA buffer.
function blendPixel(rgba, o, r, g, b, a) {
    const da = rgba[o + 3] / 255;
    const outA = a + da * (1 - a);
    if (outA <= 0)
        return;
    const keep = da * (1 - a);
    rgba[o] = (r * a + rgba[o] * keep) / outA;
    rgba[o + 1] = (g * a + rgba[o + 1] * keep) / outA;
    rgba[o + 2] = (b * a + rgba[o + 2] * keep) / outA;
    rgba[o + 3] = outA * 255;
}

// A minimal software painter for small sprites. Implements the core's `paint` interface (rectangles,
// colour, fill) with translate/scale; all rectangles of one fill() are blended once, like Cairo.
export class SpritePainter {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.rgba = new Uint8ClampedArray(width * height * 4);
        this.cover = new Uint8Array(width * height);
        this.rects = [];
        this.stack = [];
        this.tx = 0; this.ty = 0; this.sx = 1; this.sy = 1;
        this.r = 0; this.g = 0; this.b = 0; this.a = 1;
    }

    translate(dx, dy) { this.tx += this.sx * dx; this.ty += this.sy * dy; }
    scale(x, y) { this.sx *= x; this.sy *= y; }
    save() { this.stack.push([this.tx, this.ty, this.sx, this.sy]); }
    restore() { [this.tx, this.ty, this.sx, this.sy] = this.stack.pop(); }
    color(rgb, alpha) { this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2]; this.a = alpha; }
    rectangle(x, y, w, h) {
        const x0 = this.tx + this.sx * x, y0 = this.ty + this.sy * y;
        this.rects.push(x0, y0, x0 + this.sx * w, y0 + this.sy * h);
    }
    moveTo() {}
    lineTo() {}
    close() {}
    clip() {}

    fill() {
        const w = this.width, h = this.height, cover = this.cover, rgba = this.rgba;
        const covered = [];
        for (let i = 0; i < this.rects.length; i += 4) {
            const xa = Math.max(0, Math.ceil(this.rects[i] - 0.5)), xb = Math.min(w, Math.ceil(this.rects[i + 2] - 0.5));
            const ya = Math.max(0, Math.ceil(this.rects[i + 1] - 0.5)), yb = Math.min(h, Math.ceil(this.rects[i + 3] - 0.5));
            for (let y = ya; y < yb; y++)
                for (let x = xa; x < xb; x++) {
                    const idx = y * w + x;
                    if (!cover[idx]) {
                        cover[idx] = 1;
                        covered.push(idx);
                    }
                }
        }
        this.rects = [];
        for (const idx of covered) {
            cover[idx] = 0;
            blendPixel(rgba, idx * 4, this.r, this.g, this.b, this.a);
        }
    }

    toUrl() { return pngUrl(this.rgba, this.width, this.height); }
}

// A soft round falloff that is exactly 0 at the edge of its square, so the image never shows a box.
const edgeFade = d => { const t = Math.min(1, Math.max(0, (1 - d) / 0.25)); return t * t * (3 - 2 * t); };

// The sun's glow: a Gaussian (see sunInfo().sigma) that fades to nothing before the edge of the square.
export function glowSpriteUrl(color, size = 96) {
    const rgba = new Uint8ClampedArray(size * size * 4);
    const half = size / 2;
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const d2 = ((x + 0.5 - half) ** 2 + (y + 0.5 - half) ** 2) / (half * half);
            const o = (y * size + x) * 4;
            rgba[o] = color[0]; rgba[o + 1] = color[1]; rgba[o + 2] = color[2];
            rgba[o + 3] = 255 * Math.exp(-4.205 * d2) * edgeFade(Math.sqrt(d2));
        }
    return pngUrl(rgba, size, size);
}

// The crescent moon with its soft halo (same shapes as core/sky.js drawMoon). Built once.
export function moonSpriteUrl(size = 128) {
    const rgba = new Uint8ClampedArray(size * size * 4);
    const c = size / 2;
    const clamp = v => Math.min(1, Math.max(0, v));
    for (let py = 0; py < size; py++)
        for (let px = 0; px < size; px++) {
            const dx = px - c, dy = py - c, d = Math.hypot(dx, dy), o = (py * size + px) * 4;
            blendPixel(rgba, o, 187, 148, 250, 0.13 * Math.exp(-d * d / 650) * edgeFade(d / c));
            const disk = clamp(11.8 - d), shadow = clamp(11.0 - Math.hypot(dx + 5.5, dy + 3.7));
            if (disk > 0)
                blendPixel(rgba, o, 255, 246, 251, disk * (1 - shadow));
        }
    return pngUrl(rgba, size, size);
}

// The dark/bright speckle along the coastline where the meadow starts (static, built once).
// Returns { url, top, height } for a band covering the first 21 rows below the shore.
export function shoreDetailSprite(hash) {
    let top = 1000, bottom = 0;
    for (const y of COAST) { top = Math.min(top, y); bottom = Math.max(bottom, y + 21); }
    const w = 960, h = bottom - top;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let x = 0; x < w; x++)
        for (let depth = 0; depth < 21; depth++) {
            const y = COAST[x] + depth;
            let light = (hash(x, y) - 0.5) * (depth < 12 ? 11 : 3);
            if (depth < 2) light -= 17;
            if (hash(x, Math.floor(y / 2)) > 0.91) light += 14;
            const o = ((y - top) * w + x) * 4;
            if (light > 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = 255; rgba[o + 3] = Math.min(255, light / 150 * 255); }
            else { rgba[o] = rgba[o + 1] = rgba[o + 2] = 0; rgba[o + 3] = Math.min(255, -light / 110 * 255); }
        }
    return { url: pngUrl(rgba, w, h), top, height: h };
}

// Sea-coloured strip that hides the straight top of the meadow rectangle above the jagged shoreline.
export function shoreStripSprite(color) {
    let top = 1000, bottom = 0;
    for (const y of COAST) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const w = 960, h = bottom - top;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let x = 0; x < w; x++)
        for (let y = top; y < COAST[x] - 1; y++) {
            const o = ((y - top) * w + x) * 4;
            rgba[o] = color[0]; rgba[o + 1] = color[1]; rgba[o + 2] = color[2]; rgba[o + 3] = 255;
        }
    return { url: pngUrl(rgba, w, h), top, height: h };
}
