// SPDX-License-Identifier: GPL-2.0-or-later
// The Coast Live scene for QML. It has no Plasma dependency: main.qml wraps it
// for the desktop, and tests/kde-harness.qml renders it into a PNG.
//
// All the maths and drawing come from the shared core (../code/*.mjs, built
// from /core); this file only owns the QML layers, timers and settings.
import QtQuick
import "../code/config.mjs" as Config
import "../code/desert.mjs" as Desert
import "../code/layout.mjs" as Layout
import "../code/qt-painter.mjs" as QtPainter
import "../code/scene.mjs" as SceneCore
import "../code/shapes.mjs" as Shapes
import "../code/sky.mjs" as SkyCore
import "../code/solar-clock.mjs" as SolarClock
import "../code/themes.mjs" as Themes
import "../code/zone-data.mjs" as ZoneData
import "../code/zones.mjs" as Zones

Item {
    id: root

    // ---- inputs
    property string theme: "coast"
    property int frameInterval: 67
    property bool manualLocation: false
    property real latitude: 0
    property real longitude: 0
    property string zoneName: ""
    property real utcOffsetSeconds: -new Date().getTimezoneOffset() * 60
    property url themesUrl: Qt.resolvedUrl("../themes")
    // For screenshots/tests: a fixed lighting frame and animation clock (-1 = follow the real sun).
    property int testFrame: -1
    property real testElapsed: 0

    clip: true

    // ---- derived scene geometry (the scene is a 960x540 pixel grid scaled to fit)
    readonly property string activeTheme: Themes.THEMES.indexOf(theme) >= 0 ? theme : "coast"
    readonly property bool desert: activeTheme !== "coast"
    readonly property real skyScale: desert ? (Layout.layout.skyScales[activeTheme] || 1) : 1
    readonly property int skyRows: desert ? Config.HORIZON : Config.HEIGHT
    readonly property int skyHeight: desert ? Math.round(Config.HORIZON * skyScale) : Config.HEIGHT
    readonly property int fxTop: desert ? Desert.DESERT_FX_TOP : Config.HORIZON

    // ---- state
    property var sky: null
    property var pixels: null
    property var light: null
    property var horizonRow: null
    property int frame: -1
    property real elapsed: 0
    property var terrain: ({ lower: 0, upper: 0, opacity: 0 })
    property var palmAngles: [0, 0]
    property real nextSolar: 0
    readonly property real startTime: Date.now()
    readonly property var tracker: new SolarClock.SolarTracker()
    readonly property var zones: Zones.parseZoneTable(ZoneData.ZONE_TAB)
    readonly property var links: Zones.parseZoneLinks(ZoneData.ZONE_LINKS)
    readonly property var cloudMasks: Shapes.makeCloudMasks()

    function layerSource(prefix, slot) {
        return themesUrl + "/" + activeTheme + "/" + Themes.layerName(prefix, slot);
    }

    function coordinates() {
        if (manualLocation)
            return [latitude, longitude];
        return Zones.resolveCoordinates(zones, links, zoneName, utcOffsetSeconds).coordinates;
    }

    function prepareSky() {
        sky = SkyCore.createSky({ rows: skyRows });
        pixels = new Uint8Array(sky.byteLength);
        // Force the next tick to recompute the lighting frame and repaint the sky.
        frame = -1;
        nextSolar = 0;
    }

    function updateSolar() {
        const place = coordinates();
        const next = testFrame >= 0 ? testFrame : tracker.frameAt(Date.now(), place[0], place[1]);
        if (next === frame)
            return;
        frame = next;
        light = SkyCore.lighting(next);
        terrain = Themes.terrainBlend(Layout.layout.anchors, next);
        skyCanvas.requestPaint();
    }

    function tick() {
        elapsed = testFrame >= 0 ? testElapsed : (Date.now() - startTime) / 1000;
        if (elapsed >= nextSolar) {
            updateSolar();
            nextSolar = elapsed + 3;
        }
        palmAngles = [Desert.palmAngle(0, elapsed), Desert.palmAngle(1, elapsed)];
        cloudCanvas.requestPaint();
        fxCanvas.requestPaint();
    }

    onActiveThemeChanged: {
        prepareSky();
        tick();
    }
    Component.onCompleted: {
        prepareSky();
        tick();
    }

    Timer {
        interval: root.frameInterval
        repeat: true
        running: root.visible && root.testFrame < 0
        onTriggered: root.tick()
    }

    Item {
        id: stage
        width: Config.WIDTH
        height: Config.HEIGHT
        transformOrigin: Item.TopLeft
        scale: Math.max(root.width / Config.WIDTH, root.height / Config.HEIGHT)
        x: (root.width - Config.WIDTH * scale) / 2
        y: (root.height - Config.HEIGHT * scale) / 2

        // Last sky row, stretched to the bottom of the picture (Sahara scenes only).
        // (A Canvas crops instead of stretching, so the stretch is a scale transform.)
        Canvas {
            id: horizonCanvas
            visible: root.desert
            y: root.skyHeight
            width: Config.WIDTH
            height: 1
            smooth: false
            transform: Scale { yScale: Config.HEIGHT - root.skyHeight }
            onPaint: {
                const row = root.horizonRow;
                if (!row)
                    return;
                const ctx = getContext("2d");
                const image = ctx.createImageData(Config.WIDTH, 1);
                const data = image.data;
                for (let i = 0, j = 0, k = 0; i < Config.WIDTH; i++) {
                    data[j++] = row[k++]; data[j++] = row[k++]; data[j++] = row[k++]; data[j++] = 255;
                }
                ctx.drawImage(image, 0, 0);
            }
        }

        // The procedural sky. It repaints only when the lighting frame changes.
        Canvas {
            id: skyCanvas
            width: Config.WIDTH
            height: root.skyRows
            transform: Scale { yScale: root.skyHeight / root.skyRows }
            onPaint: {
                if (!root.sky || root.frame < 0)
                    return;
                const rows = root.skyRows;
                const rgb = root.pixels;
                root.sky.renderFrame(root.frame, rgb);
                const ctx = getContext("2d");
                const image = ctx.createImageData(Config.WIDTH, rows);
                const data = image.data;
                for (let i = 0, j = 0, k = 0, n = Config.WIDTH * rows; i < n; i++) {
                    data[j++] = rgb[k++]; data[j++] = rgb[k++]; data[j++] = rgb[k++]; data[j++] = 255;
                }
                ctx.drawImage(image, 0, 0);
                if (root.desert) {
                    root.horizonRow = rgb.slice((rows - 1) * Config.WIDTH * 3, rows * Config.WIDTH * 3);
                    // Repainting another canvas from inside a paint handler is dropped; defer it.
                    Qt.callLater(horizonCanvas.requestPaint);
                }
            }
        }

        Canvas {
            id: cloudCanvas
            width: Config.WIDTH
            height: Config.HEIGHT
            onPaint: {
                const ctx = getContext("2d");
                ctx.clearRect(0, 0, width, height);
                if (!root.light)
                    return;
                const painter = QtPainter.qtPainter(ctx);
                for (const spec of SceneCore.CLOUDS) {
                    const position = SceneCore.cloudPosition(spec, root.elapsed);
                    ctx.save();
                    ctx.translate(position[0], position[1] * root.skyScale);
                    ctx.scale(spec.scale, spec.scale * root.skyScale);
                    SceneCore.paintCloud(painter, root.cloudMasks[spec.bank], spec, root.light, position[0], position[1]);
                    ctx.restore();
                }
            }
        }

        // Sahara terrain: two pre-lit layers cross-faded between lighting anchors.
        Item {
            visible: root.desert
            width: Config.WIDTH
            height: Config.HEIGHT
            Image {
                source: root.desert ? root.layerSource("ground", root.terrain.lower) : ""
                asynchronous: false
            }
            Image {
                source: root.desert ? root.layerSource("ground", root.terrain.upper) : ""
                asynchronous: false
                opacity: root.terrain.opacity / 255
                visible: opacity > 0
            }
        }

        // Water and grass (Coast), dust, tufts and oasis water (Sahara).
        Canvas {
            id: fxCanvas
            y: root.fxTop
            width: Config.WIDTH
            height: Config.HEIGHT - root.fxTop
            onPaint: {
                const ctx = getContext("2d");
                ctx.clearRect(0, 0, width, height);
                if (!root.light)
                    return;
                ctx.save();
                ctx.translate(0, -root.fxTop);
                const painter = QtPainter.qtPainter(ctx);
                if (root.desert) {
                    Desert.paintDesert(painter, root.elapsed, root.light, root.activeTheme);
                } else {
                    SceneCore.paintWater(painter, root.elapsed, root.light, Shapes.COAST_HALF);
                    SceneCore.paintGrass(painter, root.elapsed, root.light);
                }
                ctx.restore();
            }
        }

        // Swaying palm crowns (oasis).
        Repeater {
            model: root.activeTheme === "oasis" ? Layout.layout.palms.length : 0
            delegate: Item {
                id: palm
                required property int index
                readonly property var box: Layout.layout.palms[index]
                x: box[0]
                y: box[1]
                width: box[2] - box[0]
                height: box[3] - box[1]
                transform: Rotation {
                    origin.x: palm.width * 0.5
                    origin.y: palm.height * 0.67
                    angle: root.palmAngles[palm.index]
                }
                Image {
                    source: root.layerSource("palm-" + palm.index, root.terrain.lower)
                    asynchronous: false
                }
                Image {
                    source: root.layerSource("palm-" + palm.index, root.terrain.upper)
                    asynchronous: false
                    opacity: root.terrain.opacity / 255
                    visible: opacity > 0
                }
            }
        }
    }
}
