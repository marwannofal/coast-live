// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import static org.coastlive.core.Mathx.TAU;
import static org.coastlive.core.Mathx.blend;
import static org.coastlive.core.Mathx.clamp;
import static org.coastlive.core.Mathx.mix;
import static org.coastlive.core.Mathx.smooth;
import static org.coastlive.core.Mathx.wrap;

/** Rain, snow, fog, overcast and thunderstorms. Mirrors core/weather.js line for line. */
public final class Weather {
    public final String kind;      // clear, cloudy, fog, rain, storm, snow
    public final double intensity, cloud, wind;

    public Weather(String kind, double intensity, double cloud, double wind) {
        this.kind = kind; this.intensity = intensity; this.cloud = cloud; this.wind = wind;
    }

    public static final String[] MODES = {"off", "live", "clear", "cloudy", "fog", "drizzle", "rain", "storm", "snow"};
    public static final String[] MODE_NAMES = {"Off", "Match the real weather", "Clear", "Cloudy", "Fog", "Drizzle", "Rain", "Thunderstorm", "Snow"};
    public static final long REFRESH_MS = 30 * 60_000L;
    public static final Weather NONE = new Weather("clear", 0, 0, 0.2);

    /** The weather for a fixed mode; null for "off" and "live". */
    public static Weather forMode(String mode) {
        switch (mode) {
            case "clear": return NONE;
            case "cloudy": return new Weather("cloudy", 0, 0.85, 0.3);
            case "fog": return new Weather("fog", 0.8, 0.4, 0.1);
            case "drizzle": return new Weather("rain", 0.3, 0.8, 0.2);
            case "rain": return new Weather("rain", 0.7, 0.95, 0.4);
            case "storm": return new Weather("storm", 1, 1, 0.8);
            case "snow": return new Weather("snow", 0.6, 0.85, 0.2);
            default: return null;
        }
    }

    /** Only the position rounded to 0.1 degree (about 11 km) leaves the device. */
    public static String url(double latitude, double longitude) {
        return "https://api.open-meteo.com/v1/forecast?latitude=" + String.format(java.util.Locale.ROOT, "%.1f", latitude)
            + "&longitude=" + String.format(java.util.Locale.ROOT, "%.1f", longitude)
            + "&current=weather_code,cloud_cover,wind_speed_10m&timezone=auto";
    }

    /** WMO weather code + cloud cover (%) + wind (km/h) -> weather. */
    public static Weather fromCurrent(int code, double cover, double windSpeed) {
        double cloud = clamp(cover / 100), wind = clamp(windSpeed / 45);
        double rain = -1, snow = -1;
        switch (code) {
            case 51: rain = 0.25; break; case 53: rain = 0.35; break; case 55: rain = 0.45; break;
            case 56: rain = 0.35; break; case 57: rain = 0.5; break; case 61: rain = 0.45; break;
            case 63: rain = 0.7; break; case 65: rain = 1; break; case 66: rain = 0.5; break;
            case 67: rain = 0.9; break; case 80: rain = 0.5; break; case 81: rain = 0.8; break; case 82: rain = 1; break;
            case 71: snow = 0.4; break; case 73: snow = 0.7; break; case 75: snow = 1; break;
            case 77: snow = 0.4; break; case 85: snow = 0.5; break; case 86: snow = 0.9; break;
            default: break;
        }
        if (code >= 95) return new Weather("storm", 1, 1, Math.max(wind, 0.5));
        if (snow >= 0) return new Weather("snow", snow, Math.max(cloud, 0.8), wind);
        if (rain >= 0) return new Weather("rain", rain, Math.max(cloud, 0.8), wind);
        if (code == 45 || code == 48) return new Weather("fog", 0.8, Math.max(cloud, 0.4), wind);
        return new Weather(cloud > 0.6 ? "cloudy" : "clear", 0, cloud, wind);
    }

    // ---- overcast and fog: bands tinted over the whole picture

    public static final int BAND_HEIGHT = 10;
    public static final int BAND_COUNT = Config.HEIGHT / BAND_HEIGHT;
    private static final double[][] FOG_PROFILE = {{0, 0.45}, {200, 0.85}, {320, 0.92}, {Config.HEIGHT, 0.42}};

    private static double profile(double[][] points, double y) {
        for (int i = 1; i < points.length; i++)
            if (y <= points[i][0])
                return mix(points[i - 1][1], points[i][1], (y - points[i - 1][0]) / (points[i][0] - points[i - 1][0]));
        return points[points.length - 1][1];
    }

    /** The colour and alpha of each band, top to bottom: result[row] = {r, g, b, alpha}. */
    public static double[][] bands(Sky.Light light, Weather w) {
        double day = clamp(light.day / 255.0);
        double[] grey = blend(new double[] {46, 52, 74}, new double[] {122, 131, 147}, day);
        double[] fogColor = blend(new double[] {58, 64, 86}, new double[] {212, 216, 220}, day);
        double wet = w.kind.equals("rain") || w.kind.equals("storm") ? w.intensity : 0;
        double strength = 0.6 + 0.4 * day;
        double skyAlpha = clamp(0.80 * Math.pow(w.cloud, 1.3) + 0.12 * wet) * strength;
        double groundAlpha = clamp(0.30 * Math.pow(w.cloud, 1.3) + 0.08 * wet) * strength;
        double fog = w.kind.equals("fog") ? w.intensity : 0;
        double[][] out = new double[BAND_COUNT][4];
        for (int row = 0; row < BAND_COUNT; row++) {
            double y = (row + 0.5) * BAND_HEIGHT;
            double cloudAlpha = mix(skyAlpha, groundAlpha, smooth(y / Config.HEIGHT));
            double fogAlpha = fog * profile(FOG_PROFILE, y);
            double alpha = 1 - (1 - cloudAlpha) * (1 - fogAlpha);
            for (int i = 0; i < 3; i++)
                out[row][i] = alpha > 0 ? (fogColor[i] * fogAlpha + grey[i] * cloudAlpha * (1 - fogAlpha)) / alpha : grey[i];
            out[row][3] = alpha;
        }
        return out;
    }

    // ---- rain and snow: a few layers of falling particles (see core/weather.js)

    public static final class Layer {
        public final double speed, alpha, share;
        public final int length, span, size;
        public int count;
        Layer(double speed, int length, int span, int size, double share, double alpha) {
            this.speed = speed; this.length = length; this.span = span; this.size = size; this.share = share; this.alpha = alpha;
        }
        /** Seconds this layer takes to fall one screen height. */
        public double period() { return Config.HEIGHT / speed; }
    }

    private static final int MAX_PER_LAYER = 140;
    private static final double[][][] LAYER_RANDOM = new double[3][MAX_PER_LAYER][3];
    static {
        for (int k = 0; k < 3; k++) {
            Mathx.Random next = new Mathx.Random(4417 + k * 101);
            for (double[] p : LAYER_RANDOM[k]) for (int i = 0; i < 3; i++) p[i] = next.next();
        }
    }

    public static int particleCount(Weather w) {
        if (w.kind.equals("storm")) return 310;
        if (w.kind.equals("rain")) return (int) Math.round(90 + 200 * w.intensity);
        if (w.kind.equals("snow")) return (int) Math.round(70 + 190 * w.intensity);
        return 0;
    }

    /** The layers to draw; empty when it is not raining or snowing. */
    public static Layer[] layers(Weather w) {
        int total = particleCount(w);
        Layer[] layers;
        if (w.kind.equals("snow"))
            layers = new Layer[] {new Layer(26, 0, 0, 2, 0.50, 0.70), new Layer(40, 0, 0, 3, 0.30, 0.85), new Layer(60, 0, 0, 4, 0.20, 1.00)};
        else if (total > 0)
            layers = new Layer[] {new Layer(380, 5, 3, 0, 0.40, 0.55), new Layer(540, 8, 4, 0, 0.35, 0.80), new Layer(740, 12, 5, 0, 0.25, 1.00)};
        else
            return new Layer[0];
        for (Layer l : layers) l.count = Math.min(MAX_PER_LAYER, (int) Math.round(total * l.share));
        return layers;
    }

    /** {r, g, b, alpha} */
    public static double[] particleStyle(Sky.Light light, Weather w) {
        double day = clamp(light.day / 255.0);
        double[] c; double alpha;
        if (w.kind.equals("snow")) { c = blend(new double[] {185, 195, 225}, new double[] {255, 255, 255}, day); alpha = 0.95; }
        else { c = blend(new double[] {175, 190, 230}, new double[] {225, 235, 250}, day); alpha = 0.55 + 0.15 * w.intensity; }
        return new double[] {c[0], c[1], c[2], alpha};
    }

    /** Paints layer `index` as it is `scroll` pixels into its fall, in a strip `width` wide. Set the colour first. */
    public static void paintLayer(Painter paint, Weather w, int index, int width, double scroll) {
        Layer layer = layers(w)[index];
        boolean snow = w.kind.equals("snow"), slant = w.wind > 0.35;
        int count = (int) Math.round(layer.count * (double) width / Config.WIDTH);
        for (int j = 0; j < count; j++) {
            double a = LAYER_RANDOM[index][j % MAX_PER_LAYER][0], b = LAYER_RANDOM[index][j % MAX_PER_LAYER][1], c = LAYER_RANDOM[index][j % MAX_PER_LAYER][2];
            int x = (int) Math.round(a * width);
            int y = (int) Math.round(wrap(b * Config.HEIGHT + scroll, Config.HEIGHT));
            if (snow) {
                paint.rectangle(x, y, layer.size, layer.size);
                if (y + layer.size > Config.HEIGHT) paint.rectangle(x, y - Config.HEIGHT, layer.size, layer.size);
                continue;
            }
            int length = layer.length + (int) Math.floor(c * layer.span);
            int[] tops = y + length > Config.HEIGHT ? new int[] {y, y - Config.HEIGHT} : new int[] {y};
            for (int top : tops) {
                if (slant) {
                    int half = length / 2;
                    paint.rectangle(x, top, 1, half);
                    paint.rectangle(x + 1, top + half, 1, length - half);
                } else paint.rectangle(x, top, 1, length);
            }
        }
    }

    // ---- lightning

    private static final int FLASH_PERIOD = 9;

    public static double flashAlpha(double elapsed, Weather w) {
        if (!w.kind.equals("storm")) return 0;
        int n = (int) Math.floor(elapsed / FLASH_PERIOD);
        double t = elapsed - (n * FLASH_PERIOD + 2 + Mathx.hash(n, 1) * 5);
        if (t < 0 || t > 0.55) return 0;
        double flicker = t < 0.08 ? 1 : t < 0.16 ? 0.2 : t < 0.26 ? 0.8 : Math.max(0, 1 - (t - 0.26) / 0.29) * 0.5;
        return 0.55 * flicker;
    }

    public static boolean isAnimated(Weather w) { return particleCount(w) > 0 || w.kind.equals("storm"); }

    /** The still part of the weather (overcast and fog), drawn over everything. */
    public static void paintOverlay(Painter paint, Sky.Light light, Weather w) {
        double[][] bands = bands(light, w);
        for (int row = 0; row < bands.length; row++) {
            if (bands[row][3] < 0.003) continue;
            paint.color(new double[] {bands[row][0], bands[row][1], bands[row][2]}, bands[row][3]);
            paint.rectangle(0, row * BAND_HEIGHT, Config.WIDTH, BAND_HEIGHT);
            paint.fill();
        }
    }

    /** Everything at once, as one picture at time `elapsed`. */
    public static void paint(Painter paint, double elapsed, Sky.Light light, Weather w) {
        paintOverlay(paint, light, w);
        double[] style = particleStyle(light, w);
        Layer[] layers = layers(w);
        for (int i = 0; i < layers.length; i++) {
            paint.color(new double[] {style[0], style[1], style[2]}, style[3] * layers[i].alpha);
            paintLayer(paint, w, i, Config.WIDTH, elapsed * layers[i].speed);
            paint.fill();
        }
        double flash = flashAlpha(elapsed, w);
        if (flash > 0) {
            paint.color(new double[] {235, 240, 255}, flash);
            paint.rectangle(0, 0, Config.WIDTH, Config.HEIGHT);
            paint.fill();
        }
    }
}
