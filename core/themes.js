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
