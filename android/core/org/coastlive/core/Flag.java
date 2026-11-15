// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import static org.coastlive.core.Mathx.clamp;

/** The waving Jordanian flag of the Amman scene. Mirrors core/flag.js. */
public final class Flag {
    private Flag() {}

    public static final int X = 631, Y = 201, WIDTH = 44, HEIGHT = 24;
    private static final double AMPLITUDE = 3.2;
    private static final double[] BLACK = {18, 18, 18}, WHITE = {244, 244, 240}, GREEN = {24, 120, 58}, RED = {196, 32, 38};
    private static final int[][] STAR = {{0, -2}, {0, -1}, {0, 0}, {0, 1}, {0, 2}, {-1, -1}, {-1, 0}, {-1, 1}, {1, -1}, {1, 0}, {1, 1}, {-2, 0}, {2, 0}};
    private static final int STAR_X = 8;

    /** Vertical shift of column x (0 at the pole), in pixels. */
    public static int wave(int x, double elapsed) {
        double t = x / (double) (WIDTH - 1);
        return (int) Math.round(Math.sin(elapsed * 2.6 - x * 0.31) * AMPLITUDE * t * (0.4 + 0.6 * t)
            + Math.sin(elapsed * 1.3 + 1.1) * 0.8 * t);
    }

    private static double[] shade(double[] color, double[] tint) {
        double[] out = new double[3];
        for (int i = 0; i < 3; i++) out[i] = Math.min(255, color[i] * tint[i]);
        return out;
    }

    public static void paint(Painter paint, double elapsed, Sky.Light light) {
        double day = clamp(light.day / 255.0), k = 0.34 + 0.66 * day;
        double[] tint = {k * 0.96, k * 0.97, Math.min(1.15, k * 1.12)};
        double stripe = HEIGHT / 3.0, half = HEIGHT / 2.0;
        int[] waves = new int[WIDTH];
        for (int x = 0; x < WIDTH; x++) waves[x] = Y + wave(x, elapsed);

        double[][] colors = {BLACK, WHITE, GREEN};
        for (int band = 0; band < 3; band++) {
            paint.color(shade(colors[band], tint), 1);
            for (int x = 0; x < WIDTH; x++) paint.rectangle(X + x, waves[x] + band * stripe, 1, stripe);
            paint.fill();
        }
        paint.color(shade(RED, tint), 1);
        for (int x = 0; x < WIDTH; x++) {
            long reach = Math.round(half * (1 - x / (WIDTH / 2.0)));
            if (reach > 0) paint.rectangle(X + x, waves[x] + half - reach, 1, 2 * reach);
        }
        paint.fill();
        paint.color(shade(WHITE, tint), 1);
        for (int[] s : STAR) paint.rectangle(X + STAR_X + s[0], waves[STAR_X + s[0]] + half + s[1], 1, 1);
        paint.fill();
    }
}
