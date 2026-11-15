// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.wallpaper;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import org.coastlive.core.Config;
import org.coastlive.core.Surface;

/**
 * Android implementation of the core's Surface. The scene is composed on a 960x540 bitmap with
 * exact (non-antialiased) pixel semantics, then scaled to the screen in {@link #present}.
 */
final class AndroidSurface implements Surface {
    private static final int MAX_CACHED_LAYERS = 6;

    private final Bitmap target = Bitmap.createBitmap(Config.WIDTH, Config.HEIGHT, Bitmap.Config.ARGB_8888);
    private final Canvas canvas = new Canvas(target);
    private final AssetManager assets;
    private final Paint fillPaint = new Paint();
    private final Paint smoothPaint = new Paint(Paint.FILTER_BITMAP_FLAG);
    private final Paint crispPaint = new Paint();
    private final Paint layerPaint = new Paint();
    private final Paint presentPaint = new Paint(Paint.FILTER_BITMAP_FLAG);
    private final Path path = new Path();
    private final Rect src = new Rect();
    private final RectF dst = new RectF();
    private final Matrix matrix = new Matrix();
    private Bitmap sky;
    private int[] skyPixels;

    private final Map<String, Bitmap> layers = new LinkedHashMap<String, Bitmap>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Entry<String, Bitmap> eldest) {
            if (size() > MAX_CACHED_LAYERS) {
                eldest.getValue().recycle();
                return true;
            }
            return false;
        }
    };

    AndroidSurface(AssetManager assets) {
        this.assets = assets;
        fillPaint.setAntiAlias(false);
        smoothPaint.setAntiAlias(false);
    }

    // ---- Painter
    @Override public void color(double[] rgb, double alpha) {
        fillPaint.setColor(Color.argb(clamp255(alpha * 255), clamp255(rgb[0]), clamp255(rgb[1]), clamp255(rgb[2])));
    }
    private static int clamp255(double v) { return (int) Math.max(0, Math.min(255, Math.round(v))); }
    @Override public void rectangle(double x, double y, double w, double h) {
        path.addRect((float) x, (float) y, (float) (x + w), (float) (y + h), Path.Direction.CW);
    }
    @Override public void fill() { canvas.drawPath(path, fillPaint); path.rewind(); }
    @Override public void save() { canvas.save(); }
    @Override public void restore() { canvas.restore(); }
    @Override public void moveTo(double x, double y) { path.moveTo((float) x, (float) y); }
    @Override public void lineTo(double x, double y) { path.lineTo((float) x, (float) y); }
    @Override public void close() { path.close(); }
    @Override public void clip() { canvas.clipPath(path); path.rewind(); }

    // ---- transforms
    @Override public void translate(double dx, double dy) { canvas.translate((float) dx, (float) dy); }
    @Override public void scale(double sx, double sy) { canvas.scale((float) sx, (float) sy); }
    @Override public void rotateDegrees(double degrees) { canvas.rotate((float) degrees); }

    // ---- images
    @Override public void setSky(byte[] rgb, int rows) {
        if (sky == null || sky.getHeight() != rows) {
            if (sky != null) sky.recycle();
            sky = Bitmap.createBitmap(Config.WIDTH, rows, Bitmap.Config.ARGB_8888);
            skyPixels = new int[Config.WIDTH * rows];
        }
        for (int i = 0, j = 0; i < skyPixels.length; i++, j += 3)
            skyPixels[i] = 0xFF000000 | ((rgb[j] & 0xFF) << 16) | ((rgb[j + 1] & 0xFF) << 8) | (rgb[j + 2] & 0xFF);
        sky.setPixels(skyPixels, 0, Config.WIDTH, 0, 0, Config.WIDTH, rows);
    }

    @Override public void drawSky(int srcTop, int srcBottom, double dstY, double dstHeight) {
        src.set(0, srcTop, Config.WIDTH, srcBottom);
        dst.set(0, (float) dstY, Config.WIDTH, (float) (dstY + dstHeight));
        // A single stretched row must not blend with its neighbours.
        canvas.drawBitmap(sky, src, dst, srcBottom - srcTop == 1 ? crispPaint : smoothPaint);
    }

    @Override public void drawLayer(String assetPath, double alpha) {
        Bitmap bitmap = layers.get(assetPath);
        if (bitmap == null) {
            try (InputStream in = assets.open("themes/" + assetPath)) {
                bitmap = BitmapFactory.decodeStream(in);
            } catch (IOException e) {
                return;
            }
            if (bitmap == null) return;
            layers.put(assetPath, bitmap);
        }
        layerPaint.setAlpha(clamp255(alpha * 255));
        if (bitmap.getWidth() > Config.WIDTH)   // full-frame art may be stored at 2x (Amman); sprites keep their size
            canvas.drawBitmap(bitmap, null, new android.graphics.Rect(0, 0, Config.WIDTH, Config.HEIGHT), layerPaint);
        else
            canvas.drawBitmap(bitmap, 0, 0, layerPaint);
    }

    /** Scale the composed scene to cover the screen, panned horizontally by xOffset (0..1). */
    void present(Canvas screen, int width, int height, float xOffset) {
        float scale = Math.max(width / (float) Config.WIDTH, height / (float) Config.HEIGHT);
        matrix.setScale(scale, scale);
        matrix.postTranslate(-(Config.WIDTH * scale - width) * xOffset, (height - Config.HEIGHT * scale) / 2f);
        screen.drawBitmap(target, matrix, presentPaint);
    }

    void release() {
        layers.clear();
        if (sky != null) sky.recycle();
        target.recycle();
    }
}
