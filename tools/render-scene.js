// Render one complete scene to a PNG with GJS + Cairo, using the shared core.
// It composes the layers the same way the GNOME extension does, so it is a
// faithful reference for previews and for checking the other renderers.
//
//   gjs -m tools/render-scene.js THEME FRAME ELAPSED OUT.png [ZOOM]
//
//   THEME    coast | dunes | plateau | oasis
//   FRAME    lighting frame 0..1999 (e.g. 1000 = solar noon)
//   ELAPSED  animation clock in seconds (clouds, waves, grass)
import Cairo from 'cairo';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';

import { HEIGHT, HORIZON, WIDTH } from '../core/config.js';
import { DESERT_FX_TOP, paintDesert, palmAngle } from '../core/desert.js';
import { CLOUDS, cloudPosition, paintCloud, paintGrass, paintWater } from '../core/scene.js';
import { COAST_HALF, makeCloudMasks } from '../core/shapes.js';
import { createSky, lighting } from '../core/sky.js';

const [theme = 'coast', frameArg = '1000', elapsedArg = '0', outPath = 'scene.png', zoomArg = '1'] = ARGV;
const frame = Number(frameArg);
const elapsed = Number(elapsedArg);
const zoom = Number(zoomArg);
const root = GLib.path_get_dirname(GLib.path_get_dirname(import.meta.url.replace('file://', '')));
const themes = `${root}/assets/themes`;
const layout = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(`${themes}/layout.json`)[1]));

function cairoPainter(cr) {
    return {
        color: (rgb, alpha) => cr.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha),
        rectangle: (x, y, width, height) => cr.rectangle(x, y, width, height),
        fill: () => cr.fill(),
        save: () => cr.save(),
        restore: () => cr.restore(),
        moveTo: (x, y) => cr.moveTo(x, y),
        lineTo: (x, y) => cr.lineTo(x, y),
        close: () => cr.closePath(),
        clip: () => cr.clip(),
    };
}

const desert = theme !== 'coast';
const skyScale = desert ? layout.skyScales[theme] : 1;
const light = lighting(frame);

const sky = createSky({ rows: desert ? HORIZON : HEIGHT });
const pixels = new Uint8Array(sky.byteLength);
sky.renderFrame(frame, pixels);
const pixbuf = GdkPixbuf.Pixbuf.new_from_bytes(
    GLib.Bytes.new(pixels), GdkPixbuf.Colorspace.RGB, false, 8, WIDTH, sky.rows, WIDTH * 3);

const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, WIDTH * zoom, HEIGHT * zoom);
const cr = new Cairo.Context(surface);
cr.scale(zoom, zoom);
cr.setAntialias(Cairo.Antialias.NONE);

const skyHeight = desert ? Math.round(HORIZON * skyScale) : HEIGHT;
if (desert) {
    // Stretch the last sky row down to the bottom of the picture.
    cr.save();
    cr.translate(0, skyHeight);
    cr.scale(1, (HEIGHT - skyHeight));
    Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, -(sky.rows - 1));
    cr.rectangle(0, 0, WIDTH, 1);
    cr.clip();
    cr.paint();
    cr.restore();
}
cr.save();
cr.scale(1, skyHeight / sky.rows);
Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
cr.paint();
cr.restore();

const masks = makeCloudMasks();
for (const spec of CLOUDS) {
    const mask = masks[spec.bank];
    const [x, y] = cloudPosition(spec, elapsed);
    cr.save();
    cr.translate(x, y * skyScale);
    cr.scale(spec.scale, spec.scale * skyScale);
    paintCloud(cairoPainter(cr), mask, spec, light, x, y);
    cr.restore();
}

const layer = (file, alpha, x = 0, y = 0) => {
    const image = Cairo.ImageSurface.createFromPNG(`${themes}/${theme}/${file}`);
    cr.setSourceSurface(image, x, y);
    cr.paintWithAlpha(alpha);
};
const blendedLayers = (prefix, x, y) => {
    const { anchors } = layout;
    const high = anchors.findIndex(value => value > frame);
    const lower = high < 0 ? anchors.length - 1 : Math.max(0, high - 1);
    const upper = high < 0 ? lower : high;
    const opacity = lower === upper ? 0 : (frame - anchors[lower]) / (anchors[upper] - anchors[lower]);
    const name = slot => `${prefix}-${String(slot).padStart(2, '0')}.png`;
    layer(name(lower), 1, x, y);
    if (opacity > 0)
        layer(name(upper), Math.round(255 * opacity) / 255, x, y);
};

if (desert)
    blendedLayers('ground', 0, 0);

const top = desert ? DESERT_FX_TOP : HORIZON;
cr.save();
cr.translate(0, top);
cr.rectangle(0, 0, WIDTH, HEIGHT - top);
cr.clip();
const painter = cairoPainter(cr);
cr.translate(0, -top);
if (desert) {
    paintDesert(painter, elapsed, light, theme);
} else {
    paintWater(painter, elapsed, light, COAST_HALF);
    paintGrass(painter, elapsed, light);
}
cr.restore();

if (theme === 'oasis') {
    layout.palms.forEach(([x1, y1, x2, y2], i) => {
        cr.save();
        cr.translate(x1 + (x2 - x1) * 0.5, y1 + (y2 - y1) * 0.67);
        cr.rotate(palmAngle(i, elapsed) * Math.PI / 180);
        cr.translate(-(x2 - x1) * 0.5, -(y2 - y1) * 0.67);
        blendedLayers(`palm-${i}`, 0, 0);
        cr.restore();
    });
}
surface.writeToPNG(outPath);
print(`wrote ${outPath}`);
