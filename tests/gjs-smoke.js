// Runs the shared core under GJS (the engine GNOME Shell uses) and times it.
// Usage: gjs -m tests/gjs-smoke.js OUTPUT_DIR
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import { createSky, lighting } from '../core/sky.js';
import { HEIGHT, HORIZON, WIDTH } from '../core/config.js';

const outDir = ARGV[0] ?? '.';
const now = () => GLib.get_monotonic_time() / 1000;
for (const rows of [HEIGHT, HORIZON]) {
    let t = now();
    const sky = createSky({ rows });
    const pixels = new Uint8Array(sky.byteLength);
    sky.renderFrame(1000, pixels);
    print(`rows=${rows}: first frame (builds 2 plates) ${(now() - t).toFixed(1)} ms`);
    t = now();
    for (let i = 0; i < 20; i++) sky.renderFrame(300 + i * 80, pixels);
    print(`rows=${rows}: next frames avg ${((now() - t) / 20).toFixed(1)} ms (incl. building new plates as needed)`);
    t = now();
    for (let i = 0; i < 20; i++) sky.renderFrame(300 + i * 80 + 1, pixels);
    print(`rows=${rows}: warm frames avg ${((now() - t) / 20).toFixed(1)} ms`);
}
const sky = createSky({ rows: HEIGHT });
const pixels = new Uint8Array(sky.byteLength);
let t = now();
sky.renderFrame(1560, pixels);
const pixbuf = GdkPixbuf.Pixbuf.new_from_bytes(GLib.Bytes.new(pixels), GdkPixbuf.Colorspace.RGB, false, 8, WIDTH, HEIGHT, WIDTH * 3);
const big = pixbuf.scale_simple(WIDTH * 2, HEIGHT * 2, GdkPixbuf.InterpType.NEAREST);
big.savev(`${outDir}/gjs-frame-1560.jpg`, 'jpeg', ['quality'], ['90']);
print(`pixbuf + 2x scale + jpeg save: ${(now() - t).toFixed(1)} ms`);
print('lighting(1560).sun = ' + JSON.stringify(lighting(1560).sun));
