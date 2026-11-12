// SPDX-License-Identifier: GPL-2.0-or-later
// The selectable scenes, and how the pre-rendered stills used for the system
// background are indexed.
import { SKY_FRAMES } from './config.js';

export const THEMES = ['coast', 'dunes', 'plateau', 'oasis'];
export const THEME_NAMES = ['Coast', 'Golden Dunes', 'Sandstone Plateau', 'Desert Oasis'];

// Each Sahara scene ships STILL_SLOTS lit stills (still-00 ... still-32, every
// second one), evenly spaced across the lighting frames.
export const STILL_SLOTS = 17;

export function stillName(frame) {
    const slot = Math.round(frame * (STILL_SLOTS - 1) / (SKY_FRAMES - 1));
    return 'still-' + String(slot * 2).padStart(2, '0') + '.jpg';
}

// The terrain art exists at fixed lighting anchors (layout.anchors). For any
// frame, draw layer `lower` fully and layer `upper` on top at `opacity` (0..255).
export function terrainBlend(anchors, frame) {
    const high = anchors.findIndex(value => value > frame);
    const lower = high < 0 ? anchors.length - 1 : Math.max(0, high - 1);
    const upper = high < 0 ? lower : high;
    const opacity = lower === upper ? 0
        : Math.round(255 * (frame - anchors[lower]) / (anchors[upper] - anchors[lower]));
    return { lower, upper, opacity };
}

export const layerName = (prefix, slot) => prefix + '-' + String(slot).padStart(2, '0') + '.png';
