// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.test;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.geom.Path2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import org.coastlive.core.Config;
import org.coastlive.core.Surface;

/** Java2D implementation of Surface, used to render scenes on the desktop for verification. */
final class AwtSurface implements Surface {
    final BufferedImage image = new BufferedImage(Config.WIDTH, Config.HEIGHT, BufferedImage.TYPE_INT_ARGB);
    private final Graphics2D g = image.createGraphics();
    private final File assets;
    private final Map<String, BufferedImage> cache = new HashMap<>();
    private BufferedImage sky;
    private Path2D.Double path = new Path2D.Double(Path2D.WIND_NON_ZERO);
    private final Deque<AffineTransform> transforms = new ArrayDeque<>();
    private final Deque<java.awt.Shape> clips = new ArrayDeque<>();
    private Color color = Color.BLACK;

    AwtSurface(File assetsDir) {
        this.assets = assetsDir;
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    }

    @Override public void color(double[] rgb, double alpha) {
        color = new Color(f(rgb[0] / 255), f(rgb[1] / 255), f(rgb[2] / 255), f(alpha));
    }
    private static float f(double v) { return (float) Math.max(0, Math.min(1, v)); }
    @Override public void rectangle(double x, double y, double w, double h) { path.append(new java.awt.geom.Rectangle2D.Double(x, y, w, h), false); }
    @Override public void fill() { g.setColor(color); g.fill(path); path = new Path2D.Double(Path2D.WIND_NON_ZERO); }
    @Override public void save() { transforms.push(g.getTransform()); clips.push(g.getClip() == null ? new java.awt.Rectangle(-100000, -100000, 200000, 200000) : g.getClip()); }
    @Override public void restore() { g.setTransform(transforms.pop()); g.setClip(clips.pop()); }
    @Override public void moveTo(double x, double y) { path.moveTo(x, y); }
    @Override public void lineTo(double x, double y) { path.lineTo(x, y); }
    @Override public void close() { path.closePath(); }
    @Override public void clip() { g.clip(path); path = new Path2D.Double(Path2D.WIND_NON_ZERO); }
    @Override public void translate(double dx, double dy) { g.translate(dx, dy); }
    @Override public void scale(double sx, double sy) { g.scale(sx, sy); }
    @Override public void rotateDegrees(double degrees) { g.rotate(Math.toRadians(degrees)); }

    @Override public void setSky(byte[] rgb, int rows) {
        sky = new BufferedImage(Config.WIDTH, rows, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < rows; y++) for (int x = 0; x < Config.WIDTH; x++) {
            int i = (y * Config.WIDTH + x) * 3;
            sky.setRGB(x, y, ((rgb[i] & 0xFF) << 16) | ((rgb[i + 1] & 0xFF) << 8) | (rgb[i + 2] & 0xFF));
        }
    }

    @Override public void drawSky(int srcTop, int srcBottom, double dstY, double dstHeight) {
        BufferedImage part = sky.getSubimage(0, srcTop, Config.WIDTH, srcBottom - srcTop);
        AffineTransform t = g.getTransform();
        g.translate(0, dstY);
        g.scale(1, dstHeight / (srcBottom - srcTop));
        g.drawImage(part, 0, 0, null);
        g.setTransform(t);
    }

    @Override public void drawLayer(String assetPath, double alpha) {
        BufferedImage layer = cache.computeIfAbsent(assetPath, p -> {
            try { return ImageIO.read(new File(assets, p)); } catch (IOException e) { throw new RuntimeException(e); }
        });
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, (float) alpha));
        if (layer.getWidth() > Config.WIDTH)   // full-frame art may be stored at 2x (Amman)
            g.drawImage(layer, 0, 0, Config.WIDTH, Config.HEIGHT, null);
        else
            g.drawImage(layer, 0, 0, null);
        g.setComposite(AlphaComposite.SrcOver);
    }
}
