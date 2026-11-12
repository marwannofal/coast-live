// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

/**
 * Everything SceneComposer needs from a platform: the Painter operations, transforms, and two
 * kinds of image. Android implements it with android.graphics.Canvas; the desktop test with Java2D.
 */
public interface Surface extends Painter {
    void translate(double dx, double dy);
    void scale(double sx, double sy);
    void rotateDegrees(double degrees);

    /** Hand over the latest sky picture (RGB, WIDTH x rows). Called only when the frame changes. */
    void setSky(byte[] rgb, int rows);

    /** Draw sky rows [srcTop, srcBottom), full width, stretched into y range [dstY, dstY + dstHeight). */
    void drawSky(int srcTop, int srcBottom, double dstY, double dstHeight);

    /** Draw a 960x540-style PNG layer from the theme assets (e.g. "dunes/ground-05.png") at the origin. */
    void drawLayer(String assetPath, double alpha);
}
