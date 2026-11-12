// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import java.util.ArrayList;
import java.util.List;

/** Procedural shapes: the coastline and the cloud banks. Mirrors core/shapes.js. */
public final class Shapes {
    private Shapes() {}

    public static final int[] COAST = new int[Config.WIDTH];
    public static final int[] COAST_HALF = new int[Config.WIDTH / 2 + 1];

    static {
        for (int x = 0; x < Config.WIDTH; x++) {
            double h = Mathx.hash(x / 2, 11);
            COAST[x] = (int) Math.round(461 + 2.2 * Math.sin(x / 38.0) + 1.7 * Math.sin(x / 16.0)
                    + 1.5 * Math.sin(x / 7.1) - 4.5 * Math.pow(h, 3));
        }
        for (int x = 0; x < COAST_HALF.length; x++) COAST_HALF[x] = COAST[Math.min(x * 2, Config.WIDTH - 1)];
    }

    /** Run-length cloud mask: groups[tone] is a flat list of (x, y, length) spans. */
    public static final class CloudMask {
        public final int w, h;
        public final int[][] groups;
        CloudMask(int w, int h, int[][] groups) { this.w = w; this.h = h; this.groups = groups; }
    }

    private static CloudMask cloudMask(int w, int h, double[][] lobes) {
        List<List<Integer>> groups = new ArrayList<>();
        for (int i = 0; i < 35; i++) groups.add(new ArrayList<>());
        for (int y = 0; y < h; y++) {
            int[] row = new int[w];
            for (int x = 0; x < w; x++) {
                double contour = 4, inner = 4;
                int px = x / 2 * 2 + 1, py = y / 2 * 2 + 1;
                for (double[] lobe : lobes) {
                    double radial = Math.hypot((px - lobe[0]) / lobe[2], (py - lobe[1]) / lobe[3]);
                    contour = Math.min(contour, radial);
                    inner = Math.min(inner, Math.hypot((px - lobe[0] + 3) / lobe[2], (py - lobe[1] + 5) / lobe[3]));
                }
                if (contour >= 1.035) { row[x] = 0; continue; }
                double fade = Mathx.clamp((1.035 - contour) / 0.14);
                double floor = Mathx.clamp((h - py) / 28.0);
                long opacity = Math.round(5 * fade * (0.55 + 0.45 * floor));
                long tone = Math.round(4 * Mathx.clamp(0.88 - py / (double) h * 0.52 + (contour - inner) * 1.85));
                row[x] = opacity != 0 ? (int) (opacity * 5 + tone) : 0;
            }
            for (int x = 0; x < w; ) {
                int tone = row[x];
                int run = 1;
                while (x + run < w && row[x + run] == tone) run++;
                if (tone != 0) { List<Integer> g = groups.get(tone); g.add(x); g.add(y); g.add(run); }
                x += run;
            }
        }
        int[][] flat = new int[35][];
        for (int i = 0; i < 35; i++) {
            List<Integer> g = groups.get(i);
            flat[i] = new int[g.size()];
            for (int j = 0; j < flat[i].length; j++) flat[i][j] = g.get(j);
        }
        return new CloudMask(w, h, flat);
    }

    public static CloudMask[] makeCloudMasks() {
        return new CloudMask[] {
            cloudMask(174, 93, new double[][] {
                {49, 60, 37, 18}, {35, 48, 24, 19}, {64, 40, 30, 25},
                {88, 47, 27, 24}, {109, 61, 28, 15}, {133, 64, 24, 8}, {150, 52, 10, 4}}),
            cloudMask(165, 89, new double[][] {
                {32, 66, 23, 10}, {52, 59, 29, 16}, {69, 45, 25, 23},
                {87, 54, 29, 21}, {112, 61, 24, 12}, {145, 45, 11, 5}}),
        };
    }
}
