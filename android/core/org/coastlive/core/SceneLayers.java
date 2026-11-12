// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import static org.coastlive.core.Mathx.TAU;
import static org.coastlive.core.Mathx.blend;
import static org.coastlive.core.Mathx.clamp;
import static org.coastlive.core.Mathx.wrap;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/** Animated Coast layers: clouds, water ripples and grass. Mirrors core/scene.js. */
public final class SceneLayers {
    private SceneLayers() {}

    private static final double[] MOONLIGHT = {174, 191, 249};

    public static final class CloudSpec {
        public final int bank; public final double x, y, scale, speed, opacity;
        CloudSpec(int bank, double x, double y, double scale, double speed, double opacity) {
            this.bank = bank; this.x = x; this.y = y; this.scale = scale; this.speed = speed; this.opacity = opacity;
        }
    }

    public static final CloudSpec[] CLOUDS = {
        new CloudSpec(1, 680, 230, 0.67, 2.5, 0.39),
        new CloudSpec(0, 23, 306, 0.65, 4.3, 0.53),
        new CloudSpec(0, 250, 279, 1.07, 7.5, 0.94),
        new CloudSpec(1, 544, 292, 0.91, 5.9, 0.81),
    };

    public static double[] cloudPosition(CloudSpec cloud, double elapsed) {
        double drift = 6 * Math.sin(elapsed * 0.13 + cloud.x);
        return new double[] {
            wrap(cloud.x + 215 + elapsed * cloud.speed + drift, Config.WIDTH + 215) - 215,
            cloud.y + 3 * Math.sin(elapsed * 0.31 + cloud.x),
        };
    }

    private static double[] d(int[] v) { return new double[] {v[0], v[1], v[2]}; }

    public static void paintCloud(Painter paint, Shapes.CloudMask mask, CloudSpec cloud, Sky.Light light, double x, double y) {
        double distance = Math.hypot(x + mask.w * cloud.scale / 2 - light.sun[0], y + 36 - light.sun[1]);
        double sun = light.sun[2] / 255.0 * Math.exp(-(distance * distance) / (2 * 154.0 * 154.0));
        double moonDistance = Math.hypot(x + mask.w * cloud.scale / 2 - light.moon[0], y + 36 - light.moon[1]);
        double moon = light.moon[2] / 255.0 * Math.exp(-(moonDistance * moonDistance) / (2 * 155.0 * 155.0));
        double[] base = blend(blend(d(light.cloud), d(light.sunlight), sun * 0.4), MOONLIGHT, moon * 0.22);
        double[] color = new double[3];
        for (int tone = 0; tone < mask.groups.length; tone++) {
            int[] spans = mask.groups[tone];
            if (spans.length == 0) continue;
            double opacity = Math.floor(tone / 5) / 6 * cloud.opacity;
            double shade = 0.71 + (tone % 5) * 0.073;
            for (int c = 0; c < 3; c++) color[c] = base[c] * shade;
            paint.color(color, opacity);
            for (int i = 0; i < spans.length; i += 3) paint.rectangle(spans[i], spans[i + 1], spans[i + 2], 1);
            paint.fill();
        }
    }

    private static final class Ripple { double x, offset, speed, drift, length, shape; }

    private static final class Blade { int height; double offset, curve; int tone; }

    private static final class Tuft { int x, y; double size; List<Blade> blades = new ArrayList<>(); }

    private static final Ripple[] RIPPLES = new Ripple[166];
    private static final List<Tuft> TUFTS = new ArrayList<>();

    static {
        Mathx.Random random = new Mathx.Random(2317);
        for (int i = 0; i < RIPPLES.length; i++) {
            Ripple r = new Ripple();
            r.x = random.next() * Config.WIDTH;
            r.offset = random.next();
            r.speed = 0.11 + 0.16 * random.next();
            r.drift = random.next() * 8 - 4;
            r.length = 3 + 40 * Math.pow(random.next(), 2);
            r.shape = random.next() * TAU;
            RIPPLES[i] = r;
        }
        for (int i = 0; i < 107; i++) {
            Tuft t = new Tuft();
            t.x = (int) Math.round(i * (double) Config.WIDTH / 107 + random.next() * 23 - 10);
            double depth = Math.pow(random.next(), 1.65);
            t.y = (int) Math.round(469 + depth * 74);
            t.size = 0.39 + depth * 0.73;
            int blades = 3 + (int) Math.floor(random.next() * 5);
            for (int b = 0; b < blades; b++) {
                Blade blade = new Blade();
                blade.height = (int) Math.ceil((6 + random.next() * 16) * t.size);
                blade.offset = (random.next() - 0.5) * 9 * t.size;
                blade.curve = (random.next() - 0.31) * 0.65;
                blade.tone = (int) Math.floor(random.next() * 3);
                t.blades.add(blade);
            }
            TUFTS.add(t);
        }
        Collections.sort(TUFTS, new Comparator<Tuft>() {   // stable, like Array.prototype.sort
            @Override public int compare(Tuft a, Tuft b) { return Integer.compare(a.y, b.y); }
        });
    }

    public static void paintWater(Painter paint, double elapsed, Sky.Light light, int[] coast) {
        double day = light.day / 255.0;
        double[] glow = blend(new double[] {124, 153, 224}, new double[] {214, 247, 255}, day);
        double[] dark = blend(d(light.sea), new double[] {22, 31, 65}, 0.62);
        paint.save();
        paint.moveTo(0, Config.HORIZON + 3);
        paint.lineTo(Config.WIDTH, Config.HORIZON + 3);
        for (int i = coast.length - 1; i >= 0; i--) paint.lineTo(i * 2, coast[i] - 1);
        paint.close();
        paint.clip();

        for (int crest = 0; crest < 7; crest++) {
            double phase = wrap(elapsed * 0.19 + crest / 7.0, 1);
            double depth = Math.pow(phase, 1.8);
            double baseY = 427 + depth * 38;
            double fade = Math.sin(phase * Math.PI) * (0.36 + depth * 0.64);
            paint.color(dark, fade * 0.21);
            for (int x = 0; x < Config.WIDTH; x += 8) {
                double swell = Math.sin(x * 0.022 + crest * 1.7 + elapsed * 0.73);
                double cross = Math.sin(x * 0.009 - elapsed * 0.51 + crest);
                if (cross > -0.15) paint.rectangle(x, Math.round(baseY + (swell + cross) * depth), 8, 1);
            }
            paint.fill();
        }

        for (Ripple ripple : RIPPLES) {
            double phase = wrap(elapsed * ripple.speed + ripple.offset, 1);
            double depth = Math.pow(phase, 1.67);
            int x = (int) Math.floor(wrap(ripple.x + elapsed * ripple.drift + 23, Config.WIDTH + 46) - 23);
            int y = (int) Math.round(427 + depth * 36 + Math.sin(x * 0.017 + ripple.shape) * depth * 2.3);
            int width = (int) Math.ceil(ripple.length * (0.38 + depth * 0.81));
            double strength = Math.pow(Math.sin(phase * Math.PI), 1.4);
            double center = x + width / 2.0;
            double sunDx = (center - light.sun[0]) / (18 + depth * 91);
            double moonDx = (center - light.moon[0]) / (15 + depth * 57);
            double lowSun = 0.16 + 0.84 * clamp((light.sun[1] - 95) / 310.0);
            double sun = light.sun[2] / 255.0 * Math.exp(-0.5 * sunDx * sunDx) * lowSun;
            double moon = light.moon[2] / 255.0 * Math.exp(-0.5 * moonDx * moonDx);
            double[] reflection = blend(blend(glow, d(light.sunlight), sun * 0.93), MOONLIGHT, moon * 0.76);
            paint.color(dark, strength * (0.11 + depth * 0.13));
            paint.rectangle(x + 1, y + 1, width + 2, 1);
            paint.fill();
            paint.color(reflection, strength * Math.min(0.76, 0.19 + day * 0.08 + sun * 0.54 + moon * 0.43));
            paint.rectangle(x, y, width, 1);
            if (depth > 0.63 && width > 14) paint.rectangle(x + Math.round(width * 0.36), y - 1, Math.round(width * 0.30), 1);
            paint.fill();
        }
        paint.restore();
    }

    public static void paintGrass(Painter paint, double elapsed, Sky.Light light) {
        double day = light.day / 255.0, sun = light.sun[2] / 255.0, moon = light.moon[2] / 255.0;
        double[] hue = blend(blend(d(light.grass), d(light.sunlight), sun * (0.16 + day * 0.07)), MOONLIGHT, moon * 0.13);
        double[][] tones = new double[3][3];
        tones[0] = blend(d(light.grass), new double[] {17, 25, 12}, 0.62);
        double[] lift1 = {21, 34, 5}, lift2 = {46, 58, 10};
        for (int c = 0; c < 3; c++) {
            tones[1][c] = Math.min(255, hue[c] + lift1[c] * (0.43 + 0.57 * day));
            tones[2][c] = Math.min(255, hue[c] + lift2[c] * (0.39 + 0.61 * day));
        }
        for (int tone = 0; tone < 3; tone++) {
            paint.color(tones[tone], tone == 0 ? 0.49 : 0.76);
            for (Tuft tuft : TUFTS) {
                double wind = 0.29 + 0.51 * Math.sin(elapsed * 1.56 - tuft.x * 0.012)
                        + 0.21 * Math.sin(elapsed * 3.02 + tuft.x * 0.023 + tuft.y * 0.08);
                for (Blade blade : tuft.blades) {
                    if (blade.tone != tone) continue;
                    double root = tuft.x + blade.offset;
                    long previousX = Math.round(root);
                    for (int rise = 0; rise < blade.height; rise++) {
                        double progress = rise / (double) blade.height;
                        double bend = blade.height * (blade.curve * progress + wind * progress * progress);
                        long x = Math.round(root + bend);
                        long width = Math.max(1, Math.round(2.7 * tuft.size * (1 - progress)));
                        paint.rectangle(Math.min(previousX, x), tuft.y - rise, width + Math.abs(x - previousX), 1);
                        previousX = x;
                    }
                }
            }
            paint.fill();
        }
    }
}
