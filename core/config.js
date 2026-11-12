// SPDX-License-Identifier: GPL-2.0-or-later
// Constants that every renderer agrees on. Change them here, not in each file.

// The scene is drawn on a 960x540 pixel grid and scaled up to the screen.
export const WIDTH = 960;
export const HEIGHT = 540;

// Row where the sky ends and the sea (Coast) or the horizon strip (deserts) begins.
export const HORIZON = 424;

// The solar day is mapped onto this many lighting frames. A frame index is
// 0..SKY_FRAMES-1 and corresponds to SKY_KEY_SCALE sub-steps of the sky keys.
export const SKY_FRAMES = 2000;
export const SKY_KEY_SCALE = 4;
