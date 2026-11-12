// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

/** Numeric helpers. Mirrors core/math.js; integer maths is identical so the scenery matches. */
public final class Mathx {
    private Mathx() {}

    public static final double TAU = 2 * Math.PI;

    public static double clamp(double value) { return Math.min(1, Math.max(0, value)); }
    public static double mix(double a, double b, double amount) { return a + (b - a) * amount; }
    public static double smooth(double t) { return t * t * (3 - 2 * t); }
    public static double wrap(double value, double period) { return ((value % period) + period) % period; }

    public static double[] blend(double[] a, double[] b, double amount) {
        double[] out = new double[a.length];
        for (int i = 0; i < a.length; i++) out[i] = mix(a[i], b[i], amount);
        return out;
    }

    /** Integer hash in [0, 1), bit-for-bit the same as the JavaScript version. */
    public static double hash(int x, int y) {
        int value = ((x + 197) * 374761393) ^ ((y + 911) * 668265263);
        value = (value ^ (value >>> 13)) * 1274126177;
        return ((value ^ (value >>> 16)) & 0xFFFFFFFFL) / 4294967296.0;
    }

    /** Linear congruential generator, same sequence as seededRandom() in core/math.js. */
    public static final class Random {
        private int seed;
        public Random(int seed) { this.seed = seed; }
        public double next() {
            seed = seed * 1664525 + 1013904223;
            return (seed & 0xFFFFFFFFL) / 4294967296.0;
        }
    }
}
