// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.test;

import java.io.File;
import javax.imageio.ImageIO;
import org.coastlive.core.SceneComposer;
import org.coastlive.core.Sky;
import org.coastlive.core.Weather;

/** Renders a scene with the Java core. Usage: RenderScene ASSETS_THEMES_DIR THEME FRAME ELAPSED OUT.png [WEATHER] */
public final class RenderScene {
    public static void main(String[] a) throws Exception {
        System.setProperty("java.awt.headless", "true");
        String theme = a[1];
        int frame = Integer.parseInt(a[2]);
        double elapsed = Double.parseDouble(a[3]);
        SceneComposer composer = new SceneComposer(theme);
        Sky.Renderer sky = new Sky.Renderer(composer.skyRows);
        byte[] rgb = new byte[sky.byteLength()];
        sky.renderFrame(frame, rgb);
        AwtSurface surface = new AwtSurface(new File(a[0]));
        surface.setSky(rgb, composer.skyRows);
        composer.compose(surface, Sky.lighting(frame), frame, elapsed);
        Weather weather = a.length > 5 ? Weather.forMode(a[5]) : null;
        if (weather != null) Weather.paint(surface, elapsed, Sky.lighting(frame), weather);
        ImageIO.write(surface.image, "png", new File(a[4]));
    }
}
