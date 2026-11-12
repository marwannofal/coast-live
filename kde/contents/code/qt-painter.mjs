// SPDX-License-Identifier: GPL-2.0-or-later
// Adapter from the core's `paint` interface to a QML Canvas 2D context.
export function qtPainter(ctx) {
    return {
        color: (rgb, alpha) => {
            ctx.fillStyle = 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ','
                + Math.round(rgb[2]) + ',' + alpha + ')';
        },
        rectangle: (x, y, width, height) => ctx.rect(x, y, width, height),
        // Cairo consumes the path on fill/clip; Canvas keeps it, so start a new one.
        fill: () => { ctx.fill(); ctx.beginPath(); },
        save: () => ctx.save(),
        restore: () => ctx.restore(),
        moveTo: (x, y) => ctx.moveTo(x, y),
        lineTo: (x, y) => ctx.lineTo(x, y),
        close: () => ctx.closePath(),
        clip: () => { ctx.clip(); ctx.beginPath(); },
    };
}
