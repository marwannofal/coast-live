// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

/**
 * Stacks the layers of one scene in the right order and geometry. This is the Java twin of the
 * layer logic in gnome/extension.js, kde/contents/ui/CoastScene.qml and tools/render-scene.js.
 */
public final class SceneComposer {
    public final String theme;
    public final boolean desert;
    private final double skyScale;
    public final int skyRows;
    private final int skyHeight;
    private final int fxTop;
    private final Shapes.CloudMask[] masks = Shapes.makeCloudMasks();

    public SceneComposer(String theme) {
        this.theme = theme;
        this.desert = !theme.equals("coast");
        this.skyScale = desert ? Layout.skyScale(theme) : 1;
        this.skyRows = desert ? Config.HORIZON : Config.HEIGHT;
        this.skyHeight = desert ? (int) Math.round(Config.HORIZON * skyScale) : Config.HEIGHT;
        this.fxTop = desert ? Desert.fxTop(theme) : Config.HORIZON;
    }

    private void terrain(Surface s, String prefix, int frame) {
        Themes.Blend b = Themes.terrainBlend(Layout.ANCHORS, frame);
        s.drawLayer(theme + "/" + Themes.layerName(prefix, b.lower), 1);
        if (b.opacity > 0) s.drawLayer(theme + "/" + Themes.layerName(prefix, b.upper), b.opacity / 255.0);
    }

    /** Draw the whole 960x540 scene onto `s` (the sky must already have been given to setSky). */
    public void compose(Surface s, Sky.Light light, int frame, double elapsed) {
        if (desert) s.drawSky(skyRows - 1, skyRows, skyHeight, Config.HEIGHT - skyHeight);   // last row, stretched down
        s.drawSky(0, skyRows, 0, skyHeight);

        for (SceneLayers.CloudSpec spec : SceneLayers.CLOUDS) {
            double[] p = SceneLayers.cloudPosition(spec, elapsed);
            s.save();
            s.translate(p[0], p[1] * skyScale);
            s.scale(spec.scale, spec.scale * skyScale);
            SceneLayers.paintCloud(s, masks[spec.bank], spec, light, p[0], p[1]);
            s.restore();
        }

        if (desert) terrain(s, "ground", frame);

        if (desert) {
            Desert.paintDesert(s, elapsed, light, theme);
        } else {
            SceneLayers.paintWater(s, elapsed, light, Shapes.COAST_HALF);
            SceneLayers.paintGrass(s, elapsed, light);
        }

        if (theme.equals("oasis")) {
            for (int i = 0; i < Layout.PALMS.length; i++) {
                int[] box = Layout.PALMS[i];
                double w = box[2] - box[0], h = box[3] - box[1];
                s.save();
                s.translate(box[0] + w * 0.5, box[1] + h * 0.67);
                s.rotateDegrees(Desert.palmAngle(i, elapsed));
                s.translate(-w * 0.5, -h * 0.67);
                terrain(s, "palm-" + i, frame);
                s.restore();
            }
        }
    }
}
