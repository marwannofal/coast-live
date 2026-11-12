// SPDX-License-Identifier: GPL-2.0-or-later
// Small numeric helpers shared by every part of the core. No platform APIs here.

export const TAU = 2 * Math.PI;

export const clamp = value => Math.min(1, Math.max(0, value));
export const mix = (a, b, amount) => a + (b - a) * amount;
export const smooth = t => t * t * (3 - 2 * t);
export const wrap = (value, period) => ((value % period) + period) % period;
export const blend = (a, b, amount) => a.map((channel, i) => mix(channel, b[i], amount));

// Integer hash in [0, 1). Uses only 32-bit integer maths so that ports
// (Java, Kotlin) can reproduce it exactly.
export function hash(x, y) {
    let value = Math.imul(x + 197, 374761393) ^ Math.imul(y + 911, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

// Linear congruential generator. Deterministic, so the scenery is identical
// on every platform and on every launch.
export function seededRandom(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };
}
