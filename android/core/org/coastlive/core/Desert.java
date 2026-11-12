// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import static org.coastlive.core.Mathx.TAU;
import static org.coastlive.core.Mathx.wrap;

/** Animated Sahara layers: dust, tufts and oasis water. Mirrors core/desert.js. */
public final class Desert {
    private Desert() {}

    /** Top row of the effects layer. */
    public static final int FX_TOP = 325;

    private static final double[][] GRAINS = new double[108][5];
    static {
        Mathx.Random next = new Mathx.Random(1933);
        for (double[] g : GRAINS) for (int i = 0; i < 5; i++) g[i] = next.next();
    }

    private static final int[][] OASIS_WATER = {{135, 455}, {183, 448}, {260, 441}, {364, 438}, {488, 440}, {599, 438}, {678, 440},
        {755, 448}, {812, 459}, {806, 469}, {763, 476}, {701, 485}, {628, 492}, {506, 496}, {395, 493},
        {308, 489}, {227, 482}, {155, 468}};
    private static final int[][] PLATEAU_TUFTS = {{51, 513}, {62, 515}, {78, 518}, {222, 508}, {237, 511}, {250, 514}, {843, 516}, {866, 521}, {880, 521}};
    private static final int[][] REEDS = {{167, 457}, {185, 470}, {222, 487}, {577, 495}, {796, 470}, {813, 472}};

    public static double palmAngle(int index, double elapsed) {
        return Math.sin(elapsed * 0.82 + index * 1.37) * 1.8 + Math.sin(elapsed * 2.1 + index) * 0.45;
    }

    private static double[] mix(double[] a, double[] b, double amount) {
        double[] out = new double[a.length];
        for (int i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * amount;
        return out;
    }

    private static double[] d(int[] v) { return new double[] {v[0], v[1], v[2]}; }

    private static void paintDust(Painter paint, double elapsed, Sky.Light light, String theme) {
        boolean dunes = theme.equals("dunes");
        double illumination = 0.32 + 0.68 * light.day / 255.0;
        double[] color = mix(new double[] {146, 153, 200}, new double[] {255, 216, 141}, illumination);
        for (int layer = 0; layer < 3; layer++) {
            paint.color(color, illumination * (0.10 + layer * 0.046));
            for (int i = layer; i < GRAINS.length; i += 3) {
                double a = GRAINS[i][0], b = GRAINS[i][1], c = GRAINS[i][2], dd = GRAINS[i][3], e = GRAINS[i][4];
                double phase = wrap(elapsed * (0.11 + b * 0.14) + a, 1);
                double x = dunes ? 684 + phase * 206 + dd * 57 : 125 + phase * 650 + dd * 126;
                double y = dunes ? 356 - Math.sin(phase * Math.PI) * 23 + (b - 0.5) * 19
                        : 426 + c * 48 - Math.sin(phase * Math.PI) * 14 + Math.sin(elapsed + e * TAU) * 3;
                paint.rectangle(Math.round(x), Math.round(y), 1 + Math.floor(c * 4), 1);
            }
            paint.fill();
        }
    }

    private static void paintTufts(Painter paint, double elapsed, Sky.Light light, int[][] positions, boolean oasis) {
        double daylight = light.day / 255.0;
        double[] color = mix(new double[] {132, 141, 174}, oasis ? new double[] {205, 207, 113} : new double[] {255, 207, 103}, daylight);
        paint.color(color, 0.46 + daylight * 0.29);
        for (int[] p : positions) {
            int x = p[0], y = p[1];
            for (int blade = -2; blade <= 2; blade++) {
                int height = 6 + Math.abs(blade) * 2;
                double wind = Math.sin(elapsed * 2.25 + x * 0.08);
                for (int row = 0; row < height; row++) {
                    double f = row / (double) height;
                    paint.rectangle(Math.round(x + blade * f * 4 + wind * f * f * 4), y - row, 1, 1);
                }
            }
        }
        paint.fill();
    }

    private static void paintOasisWater(Painter paint, double elapsed, Sky.Light light) {
        paint.save();
        paint.moveTo(OASIS_WATER[0][0], OASIS_WATER[0][1]);
        for (int i = 1; i < OASIS_WATER.length; i++) paint.lineTo(OASIS_WATER[i][0], OASIS_WATER[i][1]);
        paint.close();
        paint.clip();
        double day = light.day / 255.0, moon = light.moon[2] / 255.0, sun = light.sun[2] / 255.0;
        int[] celestial = sun >= moon ? light.sun : light.moon;
        double[] tint = sun >= moon ? d(light.sunlight) : new double[] {172, 198, 248};
        double[] source = mix(new double[] {110, 175, 220}, tint, 0.3 + Math.max(sun, moon) * 0.47);
        for (int layer = 0; layer < 4; layer++) {
            paint.color(source, (0.10 + 0.07 * layer) * (0.65 + day * 0.5));
            for (int i = layer; i < 80; i += 4) {
                double b = GRAINS[i][1], c = GRAINS[i][2], dd = GRAINS[i][3], e = GRAINS[i][4];
                double shift = wrap(GRAINS[i][0] + elapsed * (0.015 + e * 0.019), 1);
                double x = 128 + shift * 690;
                double y = 441 + b * 55 + Math.sin(elapsed * (0.8 + c) + dd * TAU) * 1.8;
                double glint = Math.exp(-Math.pow((x - celestial[0]) / 115, 2));
                double length = 2 + c * 10 + glint * Math.max(sun, moon) * 11;
                paint.rectangle(Math.round(x), Math.round(y), Math.round(length), 1);
            }
            paint.fill();
        }
        paint.restore();
    }

    public static void paintDesert(Painter paint, double elapsed, Sky.Light light, String theme) {
        if (theme.equals("oasis")) {
            paintOasisWater(paint, elapsed, light);
            paintTufts(paint, elapsed, light, REEDS, true);
        } else {
            paintDust(paint, elapsed, light, theme);
            if (theme.equals("plateau")) paintTufts(paint, elapsed, light, PLATEAU_TUFTS, false);
        }
    }
}
