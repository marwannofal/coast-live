// SPDX-License-Identifier: GPL-2.0-or-later
// The Coast Live scene for QML, built from native items only (no Canvas, no per-pixel work per frame):
//
//   sky, sea, meadow ..... gradients, recoloured when the lighting frame changes (every ~30 s)
//   sun, moon, clouds,
//   grass, reeds ......... small sprite images, rebuilt only when the light changes (a few ms each,
//                          queued so no single tick does much) and then moved/rotated by QML
//   ripples, waves, dust . plain Rectangles repositioned every tick (a few hundred property writes)
//   Sahara terrain, palms  pre-lit images cross-faded by opacity
//
// The maths (solar clock, palettes, sun, ripple/dust/wind motion) comes from the shared core in
// ../code/*.mjs (built from /core). It has no Plasma dependency: main.qml wraps it for the desktop and
// tests/kde-harness.qml renders it into a PNG.
import QtQuick
import "../code/config.mjs" as Config
import "../code/desert.mjs" as Desert
import "../code/layout.mjs" as Layout
import "../code/math.mjs" as MathX
import "../code/scene.mjs" as SceneCore
import "../code/shapes.mjs" as Shapes
import "../code/sky.mjs" as SkyCore
import "../code/solar-clock.mjs" as SolarClock
import "../code/sprites.mjs" as Sprites
import "../code/themes.mjs" as Themes
import "../code/zone-data.mjs" as ZoneData
import "../code/zones.mjs" as Zones

Item {
    id: root

    // ---- inputs
    property string theme: "coast"
    property int frameInterval: 100
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

    // ---- geometry (the scene is a 960x540 pixel grid scaled to fit)
    readonly property string activeTheme: Themes.THEMES.indexOf(theme) >= 0 ? theme : "coast"
    readonly property bool desert: activeTheme !== "coast"
    readonly property real skyScale: desert ? (Layout.layout.skyScales[activeTheme] || 1) : 1
    readonly property int skyHeight: Math.round(Config.HORIZON * skyScale)
    readonly property int meadowTop: 455

    // ---- state
    property var light: null
    property int frame: -1
    property real elapsed: 0
    property var terrain: ({ lower: 0, upper: 0, opacity: 0 })
    property real nextSolar: 0
    property real nextCloudTint: 0
    property var lastTuftTones: null
    property var lastGlowColor: null
    readonly property real startTime: Date.now()
    readonly property var tracker: new SolarClock.SolarTracker()
    readonly property var zones: Zones.parseZoneTable(ZoneData.ZONE_TAB)
    readonly property var links: Zones.parseZoneLinks(ZoneData.ZONE_LINKS)
    readonly property var cloudMasks: Shapes.makeCloudMasks()
    property var palmAngles: [0, 0]

    // References to the repeated items, so a tick can update them directly (no bindings to re-evaluate).
    property var starItems: []
    property var cloudItems: []
    property var rippleItems: []
    property var crestItems: []
    property var tuftItems: []
    property var dustItems: []
    property var glintItems: []
    property var staticTuftItems: []

    // ---- queued sprite jobs: at most a few ms of work per tick
    property var jobKeys: []
    property var jobFns: ({})
    function enqueue(key, fn) {
        if (!(key in jobFns))
            jobKeys.push(key);
        jobFns[key] = fn;
    }
    function pump(budgetMs) {
        const start = Date.now();
        while (jobKeys.length && Date.now() - start < budgetMs) {
            const key = jobKeys.shift();
            const fn = jobFns[key];
            delete jobFns[key];
            fn();
        }
    }

    function rgba(c, a) { return Qt.rgba(c[0] / 255, c[1] / 255, c[2] / 255, a === undefined ? 1 : a); }
    function layerSource(prefix, slot) { return themesUrl + "/" + activeTheme + "/" + Themes.layerName(prefix, slot); }

    function coordinates() {
        if (manualLocation)
            return [latitude, longitude];
        return Zones.resolveCoordinates(zones, links, zoneName, utcOffsetSeconds).coordinates;
    }

    // ---- the lighting frame changed: recolour gradients, move sun/moon, queue sprite rebuilds
    function onFrameChanged(next) {
        frame = next;
        light = SkyCore.lighting(next);
        terrain = Themes.terrainBlend(Layout.layout.anchors, next);
        const colors = SkyCore.skyColors(next);

        const skyStops = [sky0, sky1, sky2, sky3];
        for (let i = 0; i < 4; i++)
            skyStops[i].color = rgba(colors.sky[i]);
        horizonFill.color = rgba(colors.sky[3]);

        const seaStops = [sea0, sea1, sea2, sea3];
        for (let i = 0; i < 3; i++)
            seaStops[i].color = rgba(colors.sea[i]);
        sea3.color = rgba(colors.sea[2]);
        const meadowStops = [meadow0, meadow1, meadow2, meadow3, meadow4];
        const mc = [colors.meadow[0], colors.meadow[0], colors.meadow[1], colors.meadow[2], colors.meadow[2]];
        for (let i = 0; i < 5; i++)
            meadowStops[i].color = rgba(mc[i]);
        if (!desert)
            enqueue("shore", () => {
                const strip = Sprites.shoreStripSprite(colors.sea[2]);
                shoreStrip.y = strip.top;
                shoreStrip.source = strip.url;
            });

        // sun
        const sun = SkyCore.sunInfo(next);
        const glowSize = sun.sigma * 5.8;
        sunGlow.width = glowSize; sunGlow.height = glowSize;
        sunGlow.x = sun.x - glowSize / 2; sunGlow.y = sun.y - glowSize / 2;
        sunGlow.opacity = sun.strength;
        sunGlow.visible = sun.visibility > 0;
        sunDisk.x = sun.x - 15.4; sunDisk.y = sun.y - 15.4;
        sunDisk.color = rgba(sun.disk);
        sunDisk.opacity = sun.visibility;
        sunDisk.visible = sun.visibility > 0;
        const old = lastGlowColor;
        if (!old || Math.abs(old[0] - sun.glow[0]) + Math.abs(old[1] - sun.glow[1]) + Math.abs(old[2] - sun.glow[2]) > 10) {
            lastGlowColor = sun.glow;
            enqueue("glow", () => { sunGlow.source = Sprites.glowSpriteUrl(sun.glow); });
        }

        // moon and stars
        moon.x = light.moon[0] - 32; moon.y = light.moon[1] - 32;
        moon.opacity = light.moon[2] / 255;
        moon.visible = light.moon[2] > 0;
        updateStars();

        // grass: re-tint only when the tones moved noticeably
        if (!desert) {
            const tones = SceneCore.grassTones(light);
            let moved = lastTuftTones === null;
            if (!moved)
                for (let t = 0; t < 3; t++)
                    for (let c = 0; c < 3; c++)
                        moved = moved || Math.abs(tones[t][c] - lastTuftTones[t][c]) > 6;
            if (moved) {
                lastTuftTones = tones;
                for (let i = 0; i < SceneCore.GRASS_TUFTS.length; i++)
                    enqueue("tuft" + i, () => makeTuftSprite(i, tones));
            }
        } else if (activeTheme !== "dunes") {
            const oasis = activeTheme === "oasis";
            const style = Desert.tuftStyle(light, oasis);
            const positions = oasis ? Desert.REEDS : Desert.PLATEAU_TUFTS;
            for (let i = 0; i < positions.length; i++)
                enqueue("stuft" + i, () => makeStaticTuftSprite(i, positions[i], style));
        }
        updateDesertColors();
        nextCloudTint = 0;
    }

    function updateStars() {
        const stars = SkyCore.starField(frame);
        for (let i = 0; i < starItems.length; i++) {
            const item = starItems[i];
            if (i < stars.length) {
                item.x = stars[i][0]; item.y = stars[i][1];
                item.width = stars[i][2] > 0.85 ? 2 : 1; item.height = item.width;
                item.opacity = Math.min(1, stars[i][3]);
                item.visible = true;
            } else {
                item.visible = false;
            }
        }
    }

    function makeTuftSprite(i, tones) {
        if (i >= tuftItems.length)
            return;
        const tuft = SceneCore.GRASS_TUFTS[i];
        const painter = new Sprites.SpritePainter(64, 40);
        painter.translate(32 - tuft.x, 38 - tuft.y);
        SceneCore.paintTuft(painter, tuft, tones, 0.29);
        tuftItems[i].source = painter.toUrl();
    }

    function makeStaticTuftSprite(i, position, style) {
        if (i >= staticTuftItems.length)
            return;
        const painter = new Sprites.SpritePainter(40, 26);
        painter.translate(20, 24);
        painter.color(style.color, style.alpha);
        Desert.paintTuftAt(painter, 0, 0, 0);
        painter.fill();
        staticTuftItems[i].source = painter.toUrl();
    }

    function makeCloudSprite(i) {
        if (i >= cloudItems.length || !light)
            return;
        const spec = SceneCore.CLOUDS[i];
        const mask = cloudMasks[spec.bank];
        const position = SceneCore.cloudPosition(spec, elapsed);
        const painter = new Sprites.SpritePainter(mask.w, mask.h);
        SceneCore.paintCloud(painter, mask, spec, light, position[0], position[1]);
        cloudItems[i].source = painter.toUrl();
    }

    function updateDesertColors() {
        if (!desert || !light)
            return;
        const dust = Desert.dustStyle(light);
        for (let i = 0; i < dustItems.length; i++)
            dustItems[i].color = rgba(dust.color, dust.illumination * (0.10 + (i % 3) * 0.046));
        if (activeTheme === "oasis") {
            const style = Desert.glintStyle(light);
            for (let i = 0; i < glintItems.length; i++)
                glintItems[i].color = rgba(style.color, Desert.glintAlpha(i % 4, style));
        }
    }

    // ---- every tick: move things
    function tick() {
        elapsed = testFrame >= 0 ? testElapsed : (Date.now() - startTime) / 1000;
        if (elapsed >= nextSolar) {
            const place = coordinates();
            const next = testFrame >= 0 ? testFrame : tracker.frameAt(Date.now(), place[0], place[1]);
            if (next !== frame)
                onFrameChanged(next);
            nextSolar = elapsed + 3;
        }
        if (!light)
            return;

        if (elapsed >= nextCloudTint) {
            for (let i = 0; i < SceneCore.CLOUDS.length; i++)
                enqueue("cloud" + i, () => makeCloudSprite(i));
            nextCloudTint = elapsed + 4;
        }
        for (let i = 0; i < cloudItems.length; i++) {
            const position = SceneCore.cloudPosition(SceneCore.CLOUDS[i], elapsed);
            cloudItems[i].x = position[0];
            cloudItems[i].y = position[1] * skyScale;
        }

        if (!desert) {
            const colors = SceneCore.waterColors(light);
            const dark = rgba(colors.dark);
            for (let i = 0; i < crestItems.length; i++) {
                const crest = SceneCore.crestAt(i, elapsed);
                crestItems[i].y = Math.round(crest.baseY) - 427;
                crestItems[i].color = Qt.rgba(dark.r, dark.g, dark.b, crest.fade * 0.21);
            }
            for (let i = 0; i < rippleItems.length; i++) {
                const ripple = SceneCore.rippleAt(SceneCore.RIPPLES[i], elapsed, light, colors);
                const item = rippleItems[i];
                const centre = Math.min(959, Math.max(0, Math.round(ripple.x + ripple.width / 2)));
                item.visible = ripple.y < Shapes.COAST[centre] - 1;
                item.x = ripple.x; item.y = ripple.y; item.width = ripple.width;
                item.color = rgba(ripple.reflection, ripple.alpha);
            }
            for (let i = 0; i < tuftItems.length; i++)
                tuftItems[i].rotation = (SceneCore.tuftWind(SceneCore.GRASS_TUFTS[i], elapsed) - 0.29) * 24;
        } else {
            for (let i = 0; i < dustItems.length; i++) {
                const grain = Desert.dustAt(i, elapsed, activeTheme);
                dustItems[i].x = grain.x; dustItems[i].y = grain.y; dustItems[i].width = grain.width;
            }
            if (activeTheme === "oasis") {
                const style = Desert.glintStyle(light);
                for (let i = 0; i < glintItems.length; i++) {
                    const glint = Desert.glintAt(i, elapsed, style);
                    glintItems[i].x = glint.x - 135; glintItems[i].y = glint.y - 438; glintItems[i].width = glint.width;
                }
            }
            if (activeTheme !== "dunes") {
                const positions = activeTheme === "oasis" ? Desert.REEDS : Desert.PLATEAU_TUFTS;
                for (let i = 0; i < staticTuftItems.length && i < positions.length; i++) {
                    staticTuftItems[i].x = positions[i][0] - 20; staticTuftItems[i].y = positions[i][1] - 24;
                    staticTuftItems[i].rotation = Desert.tuftWindAt(positions[i][0], elapsed) * 8;
                }
            }
            palmAngles = [Desert.palmAngle(0, elapsed), Desert.palmAngle(1, elapsed)];
        }
        pump(frame >= 0 && testFrame < 0 && elapsed < 6 ? 25 : 8);
    }

    function flushAll() {
        for (let guard = 0; guard < 8; guard++) {
            tick();
            pump(100000);
        }
    }

    onActiveThemeChanged: {
        frame = -1;
        nextSolar = 0;
        lastTuftTones = null;
        jobKeys = [];
        jobFns = ({});
        Qt.callLater(tick);
    }
    Component.onCompleted: {
        tick();
        if (testFrame >= 0)
            Qt.callLater(flushAll);
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
        readonly property url moonUrl: Sprites.moonSpriteUrl()
        readonly property var shoreDetailInfo: Sprites.shoreDetailSprite(MathX.hash)

        // ---------- sky (scaled vertically for the Sahara scenes, like the original picture)
        Item {
            id: skyItem
            width: Config.WIDTH
            height: Config.HORIZON
            clip: true
            transform: Scale { yScale: root.skyScale }

            Rectangle {
                width: Config.WIDTH
                height: Config.HORIZON
                gradient: Gradient {
                    GradientStop { id: sky0; position: 0.0; color: "#3d8fd0" }
                    GradientStop { id: sky1; position: 1 / 3; color: "#57c6e8" }
                    GradientStop { id: sky2; position: 2 / 3; color: "#85ddf0" }
                    GradientStop { id: sky3; position: 1.0; color: "#c1f2f6" }
                }
            }
            Repeater {
                model: 28
                delegate: Rectangle {
                    width: 1; height: 1; color: "#eae3ff"; visible: false
                }
                onItemAdded: function (index, item) { root.starItems[index] = item; }
            }
            Image { id: sunGlow; smooth: true; visible: false }
            Rectangle { id: sunDisk; width: 30.8; height: 30.8; radius: 15.4; visible: false }
            Image { id: moon; width: 64; height: 64; smooth: true; visible: false; source: stage.moonUrl }
        }

        // ---------- below the sky (Sahara): the last sky colour continues down to the bottom
        Rectangle {
            id: horizonFill
            visible: root.desert
            y: root.skyHeight
            width: Config.WIDTH
            height: Config.HEIGHT - root.skyHeight
            color: "#c1f2f6"
        }

        // ---------- clouds: sprites repainted every few seconds, moved every tick
        Repeater {
            model: SceneCore.CLOUDS.length
            delegate: Image {
                required property int index
                smooth: true
                transform: Scale {
                    xScale: SceneCore.CLOUDS[index].scale
                    yScale: SceneCore.CLOUDS[index].scale * root.skyScale
                }
            }
            onItemAdded: function (index, item) { root.cloudItems[index] = item; }
        }

        // ---------- Coast: sea, meadow, shore, waves, ripples, grass
        Rectangle {
            visible: !root.desert
            y: Config.HORIZON
            width: Config.WIDTH
            height: Config.HEIGHT - Config.HORIZON
            gradient: Gradient {
                GradientStop { id: sea0; position: 0.0; color: "#cef5f4" }
                GradientStop { id: sea1; position: 0.151; color: "#3ca0d6" }
                GradientStop { id: sea2; position: 0.302; color: "#1b6ca5" }
                GradientStop { id: sea3; position: 1.0; color: "#1b6ca5" }
            }
        }
        Rectangle {
            visible: !root.desert
            y: root.meadowTop
            width: Config.WIDTH
            height: Config.HEIGHT - root.meadowTop
            gradient: Gradient {
                GradientStop { id: meadow0; position: 0.0; color: "#b7da6a" }
                GradientStop { id: meadow1; position: 0.0706; color: "#b7da6a" }
                GradientStop { id: meadow2; position: 0.529; color: "#70a648" }
                GradientStop { id: meadow3; position: 0.988; color: "#36713b" }
                GradientStop { id: meadow4; position: 1.0; color: "#36713b" }
            }
        }
        Image { id: shoreStrip; visible: !root.desert }
        Item {
            visible: !root.desert
            y: 427
            width: Config.WIDTH
            height: root.meadowTop - 427
            clip: true
            Repeater {
                model: root.desert ? 0 : SceneCore.CREST_COUNT
                delegate: Rectangle { width: Config.WIDTH; height: 1; color: "transparent" }
                onItemAdded: function (index, item) { root.crestItems[index] = item; }
            }
        }
        Repeater {
            model: root.desert ? 0 : SceneCore.RIPPLES.length
            delegate: Rectangle { height: 1; color: "transparent"; visible: false }
            onItemAdded: function (index, item) { root.rippleItems[index] = item; }
        }
        Image {
            visible: !root.desert
            source: root.desert ? "" : stage.shoreDetailInfo.url
            y: stage.shoreDetailInfo.top
        }
        Repeater {
            model: root.desert ? 0 : SceneCore.GRASS_TUFTS.length
            delegate: Image {
                required property int index
                x: SceneCore.GRASS_TUFTS[index].x - 32
                y: SceneCore.GRASS_TUFTS[index].y - 38
                transformOrigin: Item.Bottom
                smooth: false
            }
            onItemAdded: function (index, item) { root.tuftItems[index] = item; }
        }

        // ---------- Sahara: terrain layers, dust, oasis sparkle, tufts, palms
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
        Repeater {
            model: root.desert ? Desert.DUST_GRAINS : 0
            delegate: Rectangle { height: 1; width: 1; color: "transparent" }
            onItemAdded: function (index, item) { root.dustItems[index] = item; }
        }
        Item {
            visible: root.activeTheme === "oasis"
            x: 135; y: 438; width: 677; height: 58
            clip: true
            Repeater {
                model: root.activeTheme === "oasis" ? Desert.GLINT_GRAINS : 0
                delegate: Rectangle { height: 1; width: 1; color: "transparent" }
                onItemAdded: function (index, item) { root.glintItems[index] = item; }
            }
        }
        Repeater {
            model: root.activeTheme === "oasis" ? Desert.REEDS.length : (root.activeTheme === "plateau" ? Desert.PLATEAU_TUFTS.length : 0)
            delegate: Image { transformOrigin: Item.Bottom; smooth: false }
            onItemAdded: function (index, item) { root.staticTuftItems[index] = item; }
        }
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
