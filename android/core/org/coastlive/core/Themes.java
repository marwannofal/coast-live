// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

/** The selectable scenes and terrain-layer blending. Mirrors core/themes.js. */
public final class Themes {
    private Themes() {}

    public static final String[] THEMES = {"coast", "dunes", "plateau", "oasis", "amman"};
    public static final String[] THEME_NAMES = {"Coast", "Golden Dunes", "Sandstone Plateau", "Desert Oasis", "Amman"};

    /** Draw layer `lower` fully and layer `upper` on top at `opacity` (0..255). */
    public static final class Blend {
        public final int lower, upper, opacity;
        Blend(int lower, int upper, int opacity) { this.lower = lower; this.upper = upper; this.opacity = opacity; }
    }

    public static Blend terrainBlend(int[] anchors, double frame) {
        int high = -1;
        for (int i = 0; i < anchors.length; i++) if (anchors[i] > frame) { high = i; break; }
        int lower = high < 0 ? anchors.length - 1 : Math.max(0, high - 1);
        int upper = high < 0 ? lower : high;
        int opacity = lower == upper ? 0 : (int) Math.round(255 * (frame - anchors[lower]) / (anchors[upper] - anchors[lower]));
        return new Blend(lower, upper, opacity);
    }

    public static String layerName(String prefix, int slot) {
        return prefix + "-" + (slot < 10 ? "0" : "") + slot + ".png";
    }
}
