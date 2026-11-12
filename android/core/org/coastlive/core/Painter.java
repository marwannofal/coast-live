// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

/**
 * The tiny 2D drawing interface the scene is painted through. Mirrors the `paint` object in
 * core/scene.js: Android Canvas implements it in the app, AWT in the desktop tests.
 * Rectangles accumulate into one path until fill() or clip() consumes it.
 */
public interface Painter {
    void color(double[] rgb, double alpha);
    void rectangle(double x, double y, double width, double height);
    void fill();
    void save();
    void restore();
    void moveTo(double x, double y);
    void lineTo(double x, double y);
    void close();
    void clip();
}
