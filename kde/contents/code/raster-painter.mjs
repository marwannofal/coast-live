// SPDX-License-Identifier: GPL-2.0-or-later
// A tiny software rasteriser implementing the core's `paint` interface.
//
// Why: QML's Canvas costs milliseconds per draw call, and a frame needs thousands of tiny rectangles.
// Here the rectangles are written into a pixel buffer in plain JavaScript (only the pixels actually
// touched are visited) and Canvas receives ONE finished image per frame.
//
// It follows Cairo's non-antialiased rules: a pixel belongs to a rectangle when its centre is inside,
// and all rectangles of one fill() are a single union (overlaps are blended once).
// Supports translate/scale (no rotation), one polygon clip level, straight-alpha "over" blending.
export class RasterPainter {
    constructor(width, height) {
        const n = width * height;
        this.width = width;
        this.height = height;
        this.rgba = new Uint8ClampedArray(n * 4);   // accumulated layer (straight alpha)
        this.cover = new Uint8Array(n);             // marks pixels already covered in the current fill
        this.touched = new Int32Array(n);           // pixels covered in the current fill
        this.dirty = new Int32Array(n);             // pixels changed since the last writeTo()
        this.isDirty = new Uint8Array(n);
        this.clipMask = new Uint8Array(n);
        this.clipRows = [0, -1];
        this.clipOn = false;
        this.nDirty = 0;
        this.r = 0; this.g = 0; this.b = 0; this.a = 1;
        this.tx = 0; this.ty = 0; this.sx = 1; this.sy = 1;
        this.rects = [];
        this.poly = [];
        this.stack = [];
    }

    translate(dx, dy) { this.tx += this.sx * dx; this.ty += this.sy * dy; }
    scale(x, y) { this.sx *= x; this.sy *= y; }

    color(rgb, alpha) { this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2]; this.a = alpha; }

    rectangle(x, y, width, height) {
        const x0 = this.tx + this.sx * x;
        const y0 = this.ty + this.sy * y;
        this.rects.push(x0, y0, x0 + this.sx * width, y0 + this.sy * height);
    }

    save() { this.stack.push([this.tx, this.ty, this.sx, this.sy, this.clipOn]); }

    restore() {
        const s = this.stack.pop();
        this.tx = s[0]; this.ty = s[1]; this.sx = s[2]; this.sy = s[3]; this.clipOn = s[4];
    }

    moveTo(x, y) { this.poly.push(this.tx + this.sx * x, this.ty + this.sy * y); }
    lineTo(x, y) { this.poly.push(this.tx + this.sx * x, this.ty + this.sy * y); }
    close() {}

    // Turn the polygon built with moveTo/lineTo into the clip mask (scanlines sampled at pixel centres).
    clip() {
        const w = this.width, h = this.height, pts = this.poly;
        this.poly = [];
        if (this.clipRows[1] >= this.clipRows[0])
            this.clipMask.fill(0, this.clipRows[0] * w, (this.clipRows[1] + 1) * w);
        const count = pts.length / 2;
        let minY = Infinity, maxY = -Infinity;
        for (let i = 1; i < pts.length; i += 2) {
            if (pts[i] < minY) minY = pts[i];
            if (pts[i] > maxY) maxY = pts[i];
        }
        const y0 = Math.max(0, Math.ceil(minY - 0.5));
        const y1 = Math.min(h - 1, Math.ceil(maxY - 0.5) - 1);
        for (let y = y0; y <= y1; y++) {
            const yc = y + 0.5;
            const xs = [];
            for (let i = 0; i < count; i++) {
                const j = (i + 1) % count;
                const ya = pts[2 * i + 1], yb = pts[2 * j + 1];
                if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) {
                    const xa = pts[2 * i], xb = pts[2 * j];
                    xs.push(xa + (yc - ya) * (xb - xa) / (yb - ya));
                }
            }
            xs.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
                const xb = Math.min(w, Math.ceil(xs[k + 1] - 0.5));
                for (let x = xa; x < xb; x++)
                    this.clipMask[y * w + x] = 1;
            }
        }
        this.clipRows = [y0, y1];
        this.clipOn = true;
    }

    // Blend the queued rectangles, as one union, with the current colour.
    fill() {
        const w = this.width, h = this.height, rects = this.rects;
        const cover = this.cover, touched = this.touched, clipMask = this.clipMask, clipOn = this.clipOn;
        let n = 0;
        for (let i = 0; i < rects.length; i += 4) {
            const xa = Math.max(0, Math.ceil(rects[i] - 0.5));
            const xb = Math.min(w, Math.ceil(rects[i + 2] - 0.5));
            const ya = Math.max(0, Math.ceil(rects[i + 1] - 0.5));
            const yb = Math.min(h, Math.ceil(rects[i + 3] - 0.5));
            for (let y = ya; y < yb; y++) {
                for (let x = xa, idx = y * w + xa; x < xb; x++, idx++) {
                    if (cover[idx] || (clipOn && !clipMask[idx]))
                        continue;
                    cover[idx] = 1;
                    touched[n++] = idx;
                }
            }
        }
        this.rects = [];

        const a = this.a, sr = this.r * a, sg = this.g * a, sb = this.b * a;
        const rgba = this.rgba, isDirty = this.isDirty, dirty = this.dirty;
        let nDirty = this.nDirty;
        for (let k = 0; k < n; k++) {
            const idx = touched[k];
            cover[idx] = 0;
            const o = idx * 4;
            const da = rgba[o + 3] / 255;
            const outA = a + da * (1 - a);
            const keep = da * (1 - a);
            rgba[o] = (sr + rgba[o] * keep) / outA;
            rgba[o + 1] = (sg + rgba[o + 1] * keep) / outA;
            rgba[o + 2] = (sb + rgba[o + 2] * keep) / outA;
            rgba[o + 3] = outA * 255;
            if (!isDirty[idx]) {
                isDirty[idx] = 1;
                dirty[nDirty++] = idx;
            }
        }
        this.nDirty = nDirty;
    }

    // Copy everything drawn so far into a (zero-filled) ImageData's data array, then reset this layer.
    writeTo(data) {
        const rgba = this.rgba, dirty = this.dirty, isDirty = this.isDirty;
        for (let k = 0; k < this.nDirty; k++) {
            const idx = dirty[k], o = idx * 4;
            data[o] = rgba[o]; data[o + 1] = rgba[o + 1]; data[o + 2] = rgba[o + 2]; data[o + 3] = rgba[o + 3];
            rgba[o] = rgba[o + 1] = rgba[o + 2] = rgba[o + 3] = 0;
            isDirty[idx] = 0;
        }
        this.nDirty = 0;
    }
}
