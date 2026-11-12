// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.wallpaper;

import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.TimeZone;
import org.coastlive.core.SceneComposer;
import org.coastlive.core.Sky;
import org.coastlive.core.SolarClock;
import org.coastlive.core.Themes;
import org.coastlive.core.Zones;

/** The live wallpaper: the sky follows the sun for the device's time zone, offline. */
public class CoastService extends WallpaperService {
    static final String PREFS = "coastlive";
    static final String KEY_THEME = "theme";
    private static final long FRAME_MS = 33;          // ~30 FPS
    private static final double SOLAR_INTERVAL_S = 3;

    @Override public Engine onCreateEngine() { return new CoastEngine(); }

    private final class CoastEngine extends Engine implements SharedPreferences.OnSharedPreferenceChangeListener {
        private final HandlerThread thread = new HandlerThread("coast-live");
        private Handler handler;
        private final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        private final SolarClock.Tracker tracker = new SolarClock.Tracker();
        private Map<String, double[]> zones;
        private Map<String, String> links;
        private AndroidSurface surface;
        private SceneComposer composer;
        private Sky.Renderer sky;
        private byte[] rgb;
        private Sky.Light light;
        private int frame = -1;
        private double nextSolar;
        private long start;
        private int width, height;
        private float xOffset = 0.5f;
        private boolean visible;
        private boolean hasSurface;

        private final Runnable frameTask = new Runnable() {
            @Override public void run() {
                long begin = SystemClock.uptimeMillis();
                drawFrame();
                // Aim for a steady ~30 FPS: wait only for what is left of the frame's time budget.
                long used = SystemClock.uptimeMillis() - begin;
                if (visible && hasSurface) handler.postDelayed(this, Math.max(1, FRAME_MS - used));
            }
        };

        @Override public void onCreate(SurfaceHolder holder) {
            super.onCreate(holder);
            thread.start();
            handler = new Handler(thread.getLooper());
            prefs.registerOnSharedPreferenceChangeListener(this);
            start = SystemClock.elapsedRealtime();
            handler.post(new Runnable() { @Override public void run() { prepare(); } });
        }

        private void prepare() {
            String theme = prefs.getString(KEY_THEME, "coast");
            boolean known = false;
            for (String t : Themes.THEMES) known |= t.equals(theme);
            composer = new SceneComposer(known ? theme : "coast");
            sky = new Sky.Renderer(composer.skyRows);
            rgb = new byte[sky.byteLength()];
            if (surface == null) surface = new AndroidSurface(getAssets());
            frame = -1;
            nextSolar = 0;
        }

        @Override public void onSharedPreferenceChanged(SharedPreferences p, String key) {
            if (KEY_THEME.equals(key) && handler != null)
                handler.post(new Runnable() { @Override public void run() { prepare(); drawFrame(); } });
        }

        @Override public void onSurfaceChanged(SurfaceHolder holder, int format, final int w, final int h) {
            super.onSurfaceChanged(holder, format, w, h);
            handler.post(new Runnable() { @Override public void run() { width = w; height = h; hasSurface = true; drawFrame(); } });
        }

        @Override public void onSurfaceRedrawNeeded(SurfaceHolder holder) {
            super.onSurfaceRedrawNeeded(holder);
            handler.post(new Runnable() { @Override public void run() { drawFrame(); } });
        }

        @Override public void onSurfaceDestroyed(SurfaceHolder holder) {
            super.onSurfaceDestroyed(holder);
            handler.post(new Runnable() { @Override public void run() { hasSurface = false; handler.removeCallbacks(frameTask); } });
        }

        @Override public void onOffsetsChanged(float xOff, float yOff, float xStep, float yStep, int xPixels, int yPixels) {
            xOffset = xOff;
        }

        @Override public void onVisibilityChanged(final boolean isVisible) {
            handler.post(new Runnable() {
                @Override public void run() {
                    visible = isVisible;
                    handler.removeCallbacks(frameTask);
                    if (visible) handler.post(frameTask);
                }
            });
        }

        @Override public void onDestroy() {
            prefs.unregisterOnSharedPreferenceChangeListener(this);
            handler.removeCallbacksAndMessages(null);
            thread.quitSafely();
            if (surface != null) surface.release();
            super.onDestroy();
        }

        // ---- everything below runs on the render thread

        private String readAsset(String name) {
            try (InputStream in = getAssets().open(name)) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                for (int n; (n = in.read(buffer)) > 0; ) out.write(buffer, 0, n);
                return out.toString("UTF-8");
            } catch (IOException e) {
                return "";
            }
        }

        private double[] coordinates() {
            if (zones == null) {
                zones = Zones.parseZoneTable(readAsset("data/zone.tab"));
                links = Zones.parseZoneLinks(readAsset("data/zone-links.txt"));
            }
            TimeZone zone = TimeZone.getDefault();
            int offset = zone.getOffset(System.currentTimeMillis()) / 1000;
            return Zones.resolveCoordinates(zones, links, zone.getID(), offset);
        }

        private void updateSolar() {
            double[] place = coordinates();
            int next = tracker.frameAt(System.currentTimeMillis(), place[0], place[1]);
            if (next == frame) return;
            frame = next;
            light = Sky.lighting(next);
            sky.renderFrame(next, rgb);
            surface.setSky(rgb, composer.skyRows);
        }

        private void drawFrame() {
            if (!hasSurface || composer == null) return;
            double elapsed = (SystemClock.elapsedRealtime() - start) / 1000.0;
            if (elapsed >= nextSolar || light == null) {
                updateSolar();
                nextSolar = elapsed + SOLAR_INTERVAL_S;
            }
            composer.compose(surface, light, frame, elapsed);
            SurfaceHolder holder = getSurfaceHolder();
            Canvas canvas = Build.VERSION.SDK_INT >= 26 ? holder.lockHardwareCanvas() : holder.lockCanvas();
            if (canvas == null) return;
            try {
                surface.present(canvas, width, height, xOffset);
            } finally {
                holder.unlockCanvasAndPost(canvas);
            }
        }
    }
}
