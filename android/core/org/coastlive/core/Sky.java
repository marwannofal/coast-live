// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import static org.coastlive.core.Mathx.TAU;
import static org.coastlive.core.Mathx.clamp;
import static org.coastlive.core.Mathx.mix;
import static org.coastlive.core.Mathx.smooth;

import java.util.HashMap;
import java.util.Map;

/**
 * The procedural sky. Mirrors core/sky.js: any lighting frame is computed on demand
 * from seven palettes, a sun, a moon and a few stars.
 */
public final class Sky {
    private Sky() {}

    private static final String[] NAMES = {"night", "blue-hour", "sunrise", "morning", "noon", "evening", "sunset"};
    private static final int NIGHT = 0, BLUE_HOUR = 1, SUNRISE = 2, MORNING = 3, NOON = 4, EVENING = 5, SUNSET = 6;

    /** sky (4 stops), sea (3), meadow (3), each an [r, g, b] colour. */
    private static final double[][][][] PALETTES = {
        {   // night
            {{12, 17, 52}, {25, 20, 73}, {49, 27, 91}, {75, 58, 115}},
            {{52, 63, 114}, {20, 33, 81}, {12, 23, 57}},
            {{54, 66, 48}, {24, 42, 32}, {12, 26, 23}}},
        {   // blue-hour
            {{17, 20, 72}, {28, 37, 128}, {70, 55, 160}, {157, 113, 174}},
            {{138, 114, 164}, {60, 67, 137}, {31, 47, 96}},
            {{108, 108, 62}, {56, 72, 51}, {26, 47, 42}}},
        {   // sunrise
            {{42, 52, 150}, {110, 78, 172}, {207, 111, 162}, {251, 176, 157}},
            {{248, 186, 152}, {164, 100, 146}, {84, 68, 120}},
            {{206, 172, 70}, {111, 112, 53}, {55, 77, 45}}},
        {   // morning
            {{51, 148, 205}, {69, 176, 220}, {114, 202, 232}, {195, 232, 234}},
            {{187, 236, 238}, {64, 153, 199}, {39, 109, 159}},
            {{163, 205, 99}, {97, 155, 72}, {54, 111, 59}}},
        {   // noon
            {{64, 172, 218}, {87, 198, 232}, {133, 221, 240}, {193, 242, 246}},
            {{206, 245, 244}, {60, 160, 214}, {27, 108, 165}},
            {{183, 218, 106}, {112, 166, 72}, {54, 113, 59}}},
        {   // evening
            {{47, 77, 154}, {106, 110, 184}, {185, 135, 181}, {246, 183, 162}},
            {{236, 191, 174}, {127, 110, 172}, {61, 75, 138}},
            {{189, 177, 84}, {97, 123, 63}, {49, 86, 55}}},
        {   // sunset
            {{42, 35, 104}, {123, 45, 127}, {208, 66, 113}, {255, 136, 92}},
            {{247, 148, 108}, {135, 67, 112}, {72, 46, 85}},
            {{188, 133, 58}, {100, 92, 46}, {44, 63, 38}}},
    };

    private static final double[] KEY_POINTS = {0, 63, 90, 110, 173, 250, 328, 390, 410, 452, 500};
    private static final int[] KEY_PALETTE = {NIGHT, NIGHT, BLUE_HOUR, SUNRISE, MORNING, NOON, EVENING, SUNSET, BLUE_HOUR, NIGHT, NIGHT};
    private static final double[] SUN_POINTS = {110, 173, 250, 328, 390};
    private static final double[][] SUN_COLORS = {
        {255, 229, 152}, {221, 250, 255}, {231, 252, 255}, {255, 218, 193}, {255, 196, 99}};
    private static final double[][] CLOUD_COLORS = {
        {111, 52, 108}, {130, 63, 143}, {255, 140, 185}, {247, 204, 255}, {229, 245, 255}, {252, 186, 216}, {245, 97, 81}};

    private static final double[][] STARS = new double[28][];
    static {
        Mathx.Random random = new Mathx.Random(137);
        for (int i = 0; i < STARS.length; i++) {
            double a = Math.floor(18 + random.next() * 925);
            double b = Math.floor(17 + random.next() * 290);
            double c = random.next();
            double d = random.next() * TAU;
            STARS[i] = new double[] {a, b, c, d};
        }
    }

    private static void gradient(double[][] colors, double position, double[] out) {
        double phase = clamp(position) * (colors.length - 1);
        int step = Math.min(colors.length - 2, (int) Math.floor(phase));
        double[] from = colors[step], to = colors[step + 1];
        double amount = phase - step;
        out[0] = from[0] + (to[0] - from[0]) * amount;
        out[1] = from[1] + (to[1] - from[1]) * amount;
        out[2] = from[2] + (to[2] - from[2]) * amount;
    }

    /** Result of locating a key inside a table: values index `a`, `b` blended by `weight`. */
    private static final class Interval {
        int a, b;
        double weight;
    }

    private static Interval keyInterval(double[] points, double key) {
        Interval r = new Interval();
        int index = -1;
        for (int i = 0; i < points.length; i++) if (key < points[i]) { index = i; break; }
        if (index < 0) { r.a = r.b = points.length - 1; r.weight = 0; }
        else if (index == 0) { r.a = r.b = 0; r.weight = 0; }
        else {
            r.a = index - 1; r.b = index;
            r.weight = smooth((key - points[index - 1]) / (points[index] - points[index - 1]));
        }
        return r;
    }

    private static int toByte(double value) { return (int) Math.round(clamp(value / 255) * 255); }

    /** One pixel of one palette plate, written to out[0..2]. Reference formula. */
    static void shadePixel(int palette, int x, int y, double[] out) {
        double[][][] p = PALETTES[palette];
        double light;
        if (y < Config.HORIZON) {
            gradient(p[0], y / (double) (Config.HORIZON - 1), out);
            light = (Mathx.hash(x, y) - 0.5) * 1.14;
        } else if (y < Shapes.COAST[x]) {
            gradient(p[1], (y - Config.HORIZON) / 35.0, out);
            light = (Mathx.hash(x, y) - 0.5) * 2.0;
        } else {
            int depth = y - Shapes.COAST[x];
            gradient(p[2], (depth + 5 * Math.sin(x / 55.0 + depth / 12.0)) / 78, out);
            light = (Mathx.hash(x, y) - 0.5) * (depth < 12 ? 11 : 3);
            if (depth < 2) light -= 17;
            if (depth < 21 && Mathx.hash(x, y / 2) > 0.91) light += 14;
        }
        out[0] = toByte(out[0] + light);
        out[1] = toByte(out[1] + light);
        out[2] = toByte(out[2] + light);
    }

    /** Colours and positions the animated layers need for one lighting frame. */
    public static final class Light {
        public int[] sun = new int[3], moon = new int[3], sunlight = new int[3], cloud = new int[3];
        public int[] sea = new int[3], grass = new int[3];
        public int day;
    }

    private static double sunArc(double key) { return Math.sin(Math.PI * (key - 110) / 280); }
    private static double sunX(double key) { return 480 - 314 * Math.cos(Math.PI * (key - 110) / 280); }
    private static double sunY(double key, double arc) {
        return arc >= 0 ? Config.HORIZON - 356 * Math.pow(arc, 1.30) : Config.HORIZON - 472 * arc;
    }

    public static Light lighting(double index) {
        double key = index / Config.SKY_KEY_SCALE;
        Interval k = keyInterval(KEY_POINTS, key);
        Interval s = keyInterval(SUN_POINTS, key);
        double[] a = new double[3], b = new double[3];
        Light l = new Light();
        double arc = sunArc(key);
        double sunStrength = smooth(clamp(Math.min(key - 99, 401 - key) / 11));
        double moonTime = key >= 410 ? key - 410 : key + 90;
        double moonStrength = smooth(clamp(Math.min(moonTime, 180 - moonTime) / 31));
        l.sun[0] = (int) Math.round(sunX(key));
        l.sun[1] = (int) Math.round(sunY(key, arc));
        l.sun[2] = (int) Math.round(sunStrength * 255);
        l.moon[0] = (int) Math.round(147 + 660 * moonTime / 180);
        l.moon[1] = (int) Math.round(371 - 211 * Math.sin(Math.PI * moonTime / 180));
        l.moon[2] = (int) Math.round(moonStrength * 255);
        double[] cb = CLOUD_COLORS[KEY_PALETTE[k.a]], ca = CLOUD_COLORS[KEY_PALETTE[k.b]];
        for (int c = 0; c < 3; c++) {
            l.sunlight[c] = (int) Math.round(mix(SUN_COLORS[s.a][c], SUN_COLORS[s.b][c], s.weight));
            l.cloud[c] = (int) Math.round(mix(cb[c], ca[c], k.weight));
        }
        shadePixel(KEY_PALETTE[k.a], 480, 445, a); shadePixel(KEY_PALETTE[k.b], 480, 445, b);
        for (int c = 0; c < 3; c++) l.sea[c] = (int) Math.round(mix(a[c], b[c], k.weight));
        shadePixel(KEY_PALETTE[k.a], 480, 512, a); shadePixel(KEY_PALETTE[k.b], 480, 512, b);
        for (int c = 0; c < 3; c++) l.grass[c] = (int) Math.round(mix(a[c], b[c], k.weight));
        l.day = (int) Math.round(255 * smooth(clamp(Math.min(key - 81, 419 - key) / 53)));
        return l;
    }

    /**
     * Renders sky frames into RGB byte buffers. `rows` limits the picture to the top rows of the
     * 960x540 scene: the desert scenes need only the sky (HORIZON), Coast the whole picture.
     */
    public static final class Renderer {
        public final int rows;
        private final Map<Integer, byte[]> plates = new HashMap<>();

        public Renderer(int rows) { this.rows = rows; }

        public int byteLength() { return Config.WIDTH * rows * 3; }

        private byte[] plate(int palette) {
            byte[] plate = plates.get(palette);
            if (plate == null) { plate = buildPlate(palette); plates.put(palette, plate); }
            return plate;
        }

        private byte[] buildPlate(int palette) {
            double[][][] p = PALETTES[palette];
            byte[] plate = new byte[byteLength()];
            double[] color = new double[3], grass = new double[3];
            for (int y = 0; y < rows; y++) {
                boolean seaRow = y >= Config.HORIZON;
                if (!seaRow) gradient(p[0], y / (double) (Config.HORIZON - 1), color);
                else gradient(p[1], (y - Config.HORIZON) / 35.0, color);
                int offset = y * Config.WIDTH * 3;
                for (int x = 0; x < Config.WIDTH; x++, offset += 3) {
                    double light;
                    double[] source = color;
                    if (!seaRow) {
                        light = (Mathx.hash(x, y) - 0.5) * 1.14;
                    } else if (y < Shapes.COAST[x]) {
                        light = (Mathx.hash(x, y) - 0.5) * 2.0;
                    } else {
                        int depth = y - Shapes.COAST[x];
                        gradient(p[2], (depth + 5 * Math.sin(x / 55.0 + depth / 12.0)) / 78, grass);
                        source = grass;
                        light = (Mathx.hash(x, y) - 0.5) * (depth < 12 ? 11 : 3);
                        if (depth < 2) light -= 17;
                        if (depth < 21 && Mathx.hash(x, y / 2) > 0.91) light += 14;
                    }
                    plate[offset] = (byte) toByte(source[0] + light);
                    plate[offset + 1] = (byte) toByte(source[1] + light);
                    plate[offset + 2] = (byte) toByte(source[2] + light);
                }
            }
            return plate;
        }

        private void blendPixel(byte[] out, int x, int y, double[] color, double opacity) {
            if (x < 0 || x >= Config.WIDTH || y < 0 || y >= rows) return;
            int i = (y * Config.WIDTH + x) * 3;
            out[i] = (byte) Math.round(mix(out[i] & 0xFF, color[0], opacity));
            out[i + 1] = (byte) Math.round(mix(out[i + 1] & 0xFF, color[1], opacity));
            out[i + 2] = (byte) Math.round(mix(out[i + 2] & 0xFF, color[2], opacity));
        }

        private static final double[] MOON_GLOW = {145, 155, 231};
        private static final double[] STAR_COLOR = {234, 227, 255};
        private static final double[] HALO = {187, 148, 250};
        private static final double[] DISK = {255, 246, 251};

        private void drawMoon(byte[] out, double key) {
            double nightTime = key >= 410 ? key - 410 : key + 90;
            double progress = nightTime / 180;
            if (progress < 0 || progress > 1) return;
            double visibility = smooth(clamp(Math.min(nightTime, 180 - nightTime) / 31));
            if (visibility == 0) return;
            double x = 147 + 660 * progress;
            double y = 371 - 211 * Math.sin(Math.PI * progress);
            for (int py = 426; py < 454; py++) {
                double spread = 16 + (py - 426) * 2.3;
                double falloff = 0.16 * visibility * Math.exp(-(py - 426) / 15.0);
                for (int px = Math.max(0, (int) Math.floor(x - 3 * spread)); px <= Math.min(Config.WIDTH - 1, x + 3 * spread); px++)
                    blendPixel(out, px, py, MOON_GLOW, falloff * Math.exp(-0.5 * Math.pow((px - x) / spread, 2)));
            }
            for (double[] star : STARS) {
                double brightness = (0.19 + 0.62 * star[2]) * (0.83 + 0.17 * Math.sin(TAU * key / 50 + star[3]));
                int sx = (int) star[0], sy = (int) star[1];
                blendPixel(out, sx, sy, STAR_COLOR, brightness * visibility);
                if (star[2] > 0.85) {
                    blendPixel(out, sx + 1, sy, STAR_COLOR, brightness * visibility * 0.4);
                    blendPixel(out, sx, sy + 1, STAR_COLOR, brightness * visibility * 0.4);
                }
            }
            for (int py = (int) Math.round(y - 51); py <= Math.round(y + 51); py++) {
                for (int px = (int) Math.round(x - 51); px <= Math.round(x + 51); px++) {
                    double dx = px - x, dy = py - y;
                    double d = Math.hypot(dx, dy);
                    double glow = 0.13 * Math.exp(-d * d / 650);
                    double disk = clamp(11.8 - d);
                    double shadow = clamp(11.0 - Math.hypot(dx + 5.5, dy + 3.7));
                    blendPixel(out, px, py, HALO, glow * visibility);
                    if (disk > 0) blendPixel(out, px, py, DISK, disk * (1 - shadow) * visibility);
                }
            }
        }

        private void drawSun(byte[] out, double key, double[] color) {
            if (key < 99 || key > 401) return;
            double arc = sunArc(key), x = sunX(key), y = sunY(key, arc);
            double visibility = smooth(clamp(Math.min(key - 99, 401 - key) / 11));
            double sigma = mix(64, 98, Math.max(0, arc));
            double invVariance = 1 / (2 * sigma * sigma);
            int minX = Math.max(0, (int) Math.floor(x - 2.9 * sigma));
            int maxX = Math.min(Config.WIDTH - 1, (int) Math.ceil(x + 2.9 * sigma));
            int minY = Math.max(0, (int) Math.floor(y - 2.9 * sigma));
            int maxY = Math.min(Config.HORIZON - 1, (int) Math.ceil(y + 2.9 * sigma));
            float[] xGlow = new float[maxX - minX + 1];   // float on purpose: the JS version uses Float32Array
            for (int px = minX; px <= maxX; px++) xGlow[px - minX] = (float) Math.exp(-Math.pow(px - x, 2) * invVariance);
            double strength = visibility * mix(0.84, 0.70, Math.max(0, arc));
            for (int py = minY; py <= maxY; py++) {
                double strengthAtY = strength * Math.exp(-Math.pow(py - y, 2) * invVariance);
                for (int px = minX; px <= maxX; px++) {
                    double opacity = strengthAtY * xGlow[px - minX];
                    int i = (py * Config.WIDTH + px) * 3;
                    out[i] = (byte) Math.round(mix(out[i] & 0xFF, color[0], opacity));
                    out[i + 1] = (byte) Math.round(mix(out[i + 1] & 0xFF, color[1], opacity));
                    out[i + 2] = (byte) Math.round(mix(out[i + 2] & 0xFF, color[2], opacity));
                }
            }
            double[] disk = {255, 255, Math.round(mix(236, 255, Math.max(0, arc)))};
            for (int py = Math.max(0, (int) Math.floor(y - 16)); py < Math.min(Config.HORIZON, y + 16); py++) {
                for (int px = (int) Math.floor(x - 16); px < x + 16; px++) {
                    double opacity = clamp(15.4 - Math.hypot(px - x, py - y)) * visibility;
                    if (opacity != 0) blendPixel(out, px, py, disk, opacity);
                }
            }
            double reflection = clamp(1 - Math.abs(arc) * 3.7) * visibility * 0.5;
            if (reflection > 0) {
                for (int py = Config.HORIZON; py < 451; py++) {
                    double spread = 31 + (py - Config.HORIZON) * 3.4;
                    double intensity = reflection * Math.exp(-(py - Config.HORIZON) / 12.0);
                    for (int px = Math.max(0, (int) Math.floor(x - spread * 2)); px <= Math.min(Config.WIDTH - 1, x + spread * 2); px++)
                        blendPixel(out, px, py, color, intensity * Math.exp(-0.5 * Math.pow((px - x) / spread, 2)));
                }
            }
        }

        private static final double[] DAWN_TINT = {223, 105, 157}, DUSK_TINT = {128, 93, 208};

        /** Fill `out` (RGB, byteLength() bytes) with the sky for lighting frame `index`. */
        public void renderFrame(double index, byte[] out) {
            double key = index / Config.SKY_KEY_SCALE;
            Interval k = keyInterval(KEY_POINTS, key);
            byte[] a = plate(KEY_PALETTE[k.a]), b = plate(KEY_PALETTE[k.b]);
            if (k.weight == 0) {
                System.arraycopy(a, 0, out, 0, out.length);
            } else {
                for (int i = 0; i < out.length; i++) {
                    int av = a[i] & 0xFF;
                    out[i] = (byte) Math.round(av + ((b[i] & 0xFF) - av) * k.weight);
                }
            }
            Interval s = keyInterval(SUN_POINTS, key);
            double[] sunlight = new double[3];
            for (int c = 0; c < 3; c++) sunlight[c] = mix(SUN_COLORS[s.a][c], SUN_COLORS[s.b][c], s.weight);
            double dawn = clamp(1 - Math.abs(key - 90) / 8) * (0.82 + (key - 90) * 0.021);
            double dusk = clamp(1 - Math.abs(key - 410) / 8) * (0.82 + (410 - key) * 0.021);
            if (dawn > 0 || dusk > 0) {
                double center = dawn > 0 ? 201 : 757;
                double[] tint = dawn > 0 ? DAWN_TINT : DUSK_TINT;
                double strength = Math.max(dawn, dusk) * 0.076;
                for (int y = 307; y < Config.HORIZON; y++) {
                    double vertical = Math.pow((y - 307) / (double) (Config.HORIZON - 307), 1.7);
                    for (int x = 0; x < Config.WIDTH; x++)
                        blendPixel(out, x, y, tint, strength * vertical * Math.exp(-Math.pow(x - center, 2) / (2 * Math.pow(291, 2))));
                }
            }
            drawSun(out, key, sunlight);
            drawMoon(out, key);
        }
    }
}
