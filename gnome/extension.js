// SPDX-License-Identifier: GPL-2.0-or-later
import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { BackgroundSync } from './background-sync.js';
import { LocalLocation } from './location.js';
import { HEIGHT, HORIZON, WIDTH } from './core/config.js';
import { DESERT_FX_TOP, paintDesert, palmAngle } from './core/desert.js';
import { CLOUDS, cloudPosition, paintCloud, paintGrass, paintWater } from './core/scene.js';
import { COAST_HALF, makeCloudMasks } from './core/shapes.js';
import { createSky, lighting } from './core/sky.js';
import { solarFrame, solarSchedule } from './core/solar-clock.js';
import { stillName } from './core/themes.js';

const ANIMATION_INTERVAL_MS = { economy: 125, balanced: 67, smooth: 40, ultra: 20 };
const SOLAR_INTERVAL = 3_000_000;
const CLOUD_TINT_INTERVAL = 0.8;
const KEPT_STILLS = 2;

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

function drawingArea(width, height, paint) {
    const area = new St.DrawingArea({ width, height, reactive: false });
    area.connect('repaint', () => {
        const cr = area.get_context();
        try {
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.setOperator(Cairo.Operator.OVER);
            cr.setAntialias(Cairo.Antialias.NONE);
            paint(cairoPainter(cr), cr);
        } finally {
            cr.$dispose();
        }
    });
    return area;
}

export default class CoastLive extends Extension {
    enable() {
        this._group = Main.layoutManager._backgroundGroup;
        if (!this._group)
            throw new Error('Coast Live could not locate the desktop background group.');

        try {
            this._clouds = makeCloudMasks();
            this._views = [];
            this._content = null;
            this._horizon = null;
            this._settings = this.getSettings();
            this._theme = this._settings.get_string('theme');
            const [, layout] = this.dir.get_child('themes').get_child('layout.json').load_contents(null);
            this._layout = JSON.parse(new TextDecoder().decode(layout));
            this._terrainCache = new Map();
            this._location = new LocalLocation(this.path);
            this._motionStart = GLib.get_monotonic_time();
            this._elapsed = 0;
            this._coordinates = null;
            this._schedule = null;
            this._frame = -1;
            this._stills = [];
            this._prepareSky();
            this._nextSolar = 0;
            this._nextTint = 0;
            this._configureBackgroundSync();
            this._updateSolarFrame();
            this._buildViews();

            this._monitorSignal = Main.layoutManager.connect('monitors-changed', () => this._buildViews());
            this._backgroundSignal = this._group.connect('child-added', () => {
                for (const view of this._views)
                    this._group.set_child_above_sibling(view.root, null);
            });
            this._settingsSignals = [
                this._settings.connect('changed::animation-speed', () => this._startAnimation()),
                this._settings.connect('changed::match-gnome-background', () => this._configureBackgroundSync()),
                this._settings.connect('changed::theme', () => {
                    this._theme = this._settings.get_string('theme');
                    this._terrainCache.clear();
                    this._content = null;
                    this._horizon = null;
                    this._prepareSky();
                    this._updateSky(this._frame);
                    this._buildViews();
                    this._syncBackground(true);
                }),
            ];
            this._startAnimation();
        } catch (error) {
            this.disable();
            throw error;
        }
    }

    _startAnimation() {
        if (this._tickId)
            GLib.Source.remove(this._tickId);
        const mode = this._settings.get_string('animation-speed');
        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ANIMATION_INTERVAL_MS[mode], () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _configureBackgroundSync() {
        this._backgroundSync?.restore();
        this._backgroundSync = this._settings.get_boolean('match-gnome-background')
            ? new BackgroundSync()
            : null;
        this._syncBackground();
    }

    _themeFile(name) {
        return this.dir.get_child('themes').get_child(this._theme).get_child(name);
    }

    _syncBackground(force = false) {
        if (!this._backgroundSync || this._frame < 0)
            return;

        // The still is only produced when the background is actually due for an update.
        this._backgroundSync.update(() => this._stillUri(), GLib.get_monotonic_time(), force);
    }

    _stillUri() {
        if (this._theme !== 'coast')
            return this._themeFile(stillName(this._frame)).get_uri();

        // Coast has no shipped stills: save the current sky. A new file name per
        // frame is needed because GNOME only reloads when the picture URI changes.
        const directory = GLib.build_filenamev([GLib.get_user_cache_dir(), 'coast-live']);
        GLib.mkdir_with_parents(directory, 0o755);
        const path = GLib.build_filenamev([directory, 'coast-' + this._frame + '.jpg']);
        const pixbuf = this._skyPixbuf().scale_simple(WIDTH * 2, HEIGHT * 2, GdkPixbuf.InterpType.NEAREST);
        pixbuf.savev(path, 'jpeg', ['quality'], ['90']);
        this._stills.push(path);
        while (this._stills.length > KEPT_STILLS)
            this._deleteFile(this._stills.shift());
        return Gio.File.new_for_path(path).get_uri();
    }

    _deleteFile(path) {
        try {
            Gio.File.new_for_path(path).delete(null);
        } catch {
            // Already gone.
        }
    }

    _loadTexture(file) {
        return this._pixbufTexture(GdkPixbuf.Pixbuf.new_from_file(file.get_path()));
    }

    _pixbufTexture(pixbuf, content = null) {
        if (!content)
            content = St.ImageContent.new_with_preferred_size(pixbuf.width, pixbuf.height);
        const format = pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888;
        const args = [pixbuf.read_pixel_bytes(), format, pixbuf.width, pixbuf.height, pixbuf.rowstride];
        if (content.set_bytes.length === 6)
            args.unshift(global.stage.context.get_backend().get_cogl_context());
        if (!content.set_bytes(...args))
            throw new Error('Coast Live could not upload a wallpaper texture.');
        return content;
    }

    // Coast needs the whole picture (sea and meadow); the Sahara scenes only the sky.
    _prepareSky() {
        this._sky = createSky({ rows: this._theme === 'coast' ? HEIGHT : HORIZON });
        this._pixels = new Uint8Array(this._sky.byteLength);
    }

    _skyPixbuf() {
        return GdkPixbuf.Pixbuf.new_from_bytes(
            GLib.Bytes.new(this._pixels), GdkPixbuf.Colorspace.RGB, false, 8, WIDTH, this._sky.rows, WIDTH * 3);
    }

    _updateSky(frame) {
        this._sky.renderFrame(frame, this._pixels);
        const pixbuf = this._skyPixbuf();
        this._content = this._pixbufTexture(pixbuf, this._content);
        if (this._theme !== 'coast') {
            const horizon = pixbuf.new_subpixbuf(0, this._sky.rows - 1, WIDTH, 1);
            this._horizon = this._pixbufTexture(horizon, this._horizon);
        }
    }

    _updateTerrain() {
        if (this._theme === 'coast')
            return;

        const anchors = this._layout.anchors;
        const high = anchors.findIndex(frame => frame > this._frame);
        const lower = high < 0 ? anchors.length - 1 : Math.max(0, high - 1);
        const upper = high < 0 ? lower : high;
        const opacity = lower === upper ? 0 : Math.round(255 * (this._frame - anchors[lower]) / (anchors[upper] - anchors[lower]));
        const previous = this._terrainCache;
        const next = new Map();
        const texture = (prefix, slot) => {
            const name = prefix + '-' + String(slot).padStart(2, '0') + '.png';
            if (!next.has(name))
                next.set(name, previous.get(name) ?? this._loadTexture(this._themeFile(name)));
            return next.get(name);
        };
        const layers = (actors, prefix) => {
            actors[0].content = texture(prefix, lower);
            actors[1].content = texture(prefix, upper);
            actors[1].opacity = opacity;
        };
        for (const view of this._views) {
            layers(view.terrain, 'ground');
            for (const [i, palm] of view.palms.entries())
                layers(palm.layers, 'palm-' + i);
        }
        this._terrainCache = next;
    }

    _updateSolarFrame() {
        const time = Date.now();
        const { coordinates } = this._location.resolve(this._settings, time);
        if (!this._schedule || time < this._schedule.start || time >= this._schedule.end
            || coordinates.some((value, i) => value !== this._coordinates[i])) {
            this._schedule = solarSchedule(time, ...coordinates);
            this._coordinates = coordinates;
        }

        const frame = solarFrame(time, this._schedule);
        if (frame === this._frame) {
            this._syncBackground();
            return false;
        }

        this._updateSky(frame);
        this._frame = frame;
        this._light = lighting(frame);
        this._updateTerrain();
        this._syncBackground();
        return true;
    }

    _buildViews() {
        this._destroyViews();
        const desert = this._theme !== 'coast';
        const skyScale = desert ? this._layout.skyScales[this._theme] : 1;
        for (const monitor of Main.layoutManager.monitors) {
            const root = new St.Widget({
                x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height,
                clip_to_allocation: true, reactive: false, layout_manager: new Clutter.FixedLayout(),
            });
            const scene = new St.Widget({
                width: WIDTH, height: HEIGHT, reactive: false, layout_manager: new Clutter.FixedLayout(),
            });
            const scale = Math.max(monitor.width / WIDTH, monitor.height / HEIGHT);
            scene.set_scale(scale, scale);
            scene.set_position((monitor.width - WIDTH * scale) / 2, (monitor.height - HEIGHT * scale) / 2);
            root.add_child(scene);

            const skyHeight = desert ? Math.round(HORIZON * skyScale) : HEIGHT;
            if (desert) {
                scene.add_child(new St.Widget({
                    width: WIDTH, height: HEIGHT - skyHeight, y: skyHeight,
                    reactive: false, content: this._horizon,
                    content_gravity: Clutter.ContentGravity.RESIZE_FILL,
                }));
            }
            scene.add_child(new St.Widget({
                width: WIDTH, height: skyHeight, reactive: false, content: this._content,
                content_gravity: Clutter.ContentGravity.RESIZE_FILL,
            }));

            const clouds = CLOUDS.map(spec => {
                const mask = this._clouds[spec.bank];
                const cloud = { spec, x: 0, y: 0 };
                cloud.area = drawingArea(mask.w, mask.h, paint => {
                    paintCloud(paint, mask, spec, this._light, cloud.x, cloud.y);
                });
                cloud.area.set_scale(spec.scale, spec.scale * skyScale);
                scene.add_child(cloud.area);
                return cloud;
            });

            const newLayers = (parent, width, height) => [0, 1].map(() => {
                const actor = new St.Widget({
                    width, height, reactive: false,
                    content_gravity: Clutter.ContentGravity.RESIZE_FILL,
                });
                parent.add_child(actor);
                return actor;
            });
            const terrain = desert ? newLayers(scene, WIDTH, HEIGHT) : [];
            const top = desert ? DESERT_FX_TOP : HORIZON;
            const shore = drawingArea(WIDTH, HEIGHT - top, (paint, cr) => {
                cr.translate(0, -top);
                if (desert)
                    paintDesert(paint, this._elapsed, this._light, this._theme);
                else {
                    paintWater(paint, this._elapsed, this._light, COAST_HALF);
                    paintGrass(paint, this._elapsed, this._light);
                }
            });
            shore.set_position(0, top);
            scene.add_child(shore);
            const palms = this._theme === 'oasis' ? this._layout.palms.map(([x1, y1, x2, y2]) => {
                const crown = new St.Widget({
                    width: x2 - x1, height: y2 - y1, x: x1, y: y1, reactive: false,
                    layout_manager: new Clutter.FixedLayout(),
                });
                crown.set_pivot_point(0.5, 0.67);
                scene.add_child(crown);
                return { crown, layers: newLayers(crown, x2 - x1, y2 - y1) };
            }) : [];
            this._group.add_child(root);
            this._views.push({ root, clouds, shore, terrain, palms, skyScale });
        }
        this._updateTerrain();
        for (const view of this._views)
            this._group.set_child_above_sibling(view.root, null);
        this._animateViews(true);
    }

    _tick() {
        const monotonic = GLib.get_monotonic_time();
        this._elapsed = (monotonic - this._motionStart) / 1_000_000;
        let solarChanged = false;
        if (monotonic >= this._nextSolar) {
            solarChanged = this._updateSolarFrame();
            this._nextSolar = monotonic + SOLAR_INTERVAL;
        }
        const repaintClouds = solarChanged || this._elapsed >= this._nextTint;
        if (repaintClouds)
            this._nextTint = this._elapsed + CLOUD_TINT_INTERVAL;

        this._animateViews(repaintClouds);
    }

    _animateViews(repaintClouds) {
        for (const view of this._views) {
            if (!view.root.is_mapped())
                continue;
            for (const cloud of view.clouds) {
                [cloud.x, cloud.y] = cloudPosition(cloud.spec, this._elapsed);
                cloud.area.set_position(cloud.x, cloud.y * view.skyScale);
                if (repaintClouds)
                    cloud.area.queue_repaint();
            }
            for (const [i, palm] of view.palms.entries())
                palm.crown.rotation_angle_z = palmAngle(i, this._elapsed);
            view.shore.queue_repaint();
        }
    }

    _destroyViews() {
        for (const view of this._views ?? [])
            view.root.destroy();
        this._views = [];
    }

    disable() {
        if (this._tickId)
            GLib.Source.remove(this._tickId);
        if (this._monitorSignal)
            Main.layoutManager.disconnect(this._monitorSignal);
        if (this._backgroundSignal)
            this._group.disconnect(this._backgroundSignal);
        for (const id of this._settingsSignals ?? [])
            this._settings.disconnect(id);
        this._backgroundSync?.restore();
        for (const path of this._stills ?? [])
            this._deleteFile(path);

        this._settingsSignals = [];
        this._backgroundSync = null;
        this._stills = [];
        this._sky = null;
        this._pixels = null;
        this._clouds = null;
        this._tickId = 0;
        this._monitorSignal = 0;
        this._backgroundSignal = 0;
        this._destroyViews();
        this._group = null;
        this._content = null;
        this._horizon = null;
        this._location = null;
        this._settings = null;
        this._coordinates = null;
        this._layout = null;
        this._terrainCache = null;
        this._schedule = null;
        this._light = null;
    }
}
