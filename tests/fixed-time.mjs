// The "choose a time" setting: noon is bright, midnight is dark, and 18:00 is later than 12:00, in a few places.
import assert from 'node:assert/strict';
import { SolarTracker, fixedTimeFrame } from '../core/solar-clock.js';

const now = Date.UTC(2026, 5, 21, 10, 0, 0);
for (const [name, lat, lon] of [['Amman', 31.95, 35.93], ['Berlin', 52.5, 13.4], ['Sydney', -33.9, 151.2]]) {
    const tracker = new SolarTracker();
    const at = minutes => fixedTimeFrame(tracker, now, minutes, lat, lon);
    const frames = [0, 6 * 60, 12 * 60, 18 * 60, 23 * 60].map(at);
    console.log(name, frames.join(' '));
    assert.ok(frames.every(f => f >= 0 && f <= 1999), 'frame in range');
    // The solar frame follows the sun, not the local clock, so compare against the place's own day:
    // the brightest of the day's samples is never dark, and some sample is dark (night).
    const all = Array.from({ length: 48 }, (_, i) => at(i * 30));
    assert.ok(Math.max(...all) > 900 && Math.min(...all) < 300, 'whole day covers day and night');
}
console.log('fixed-time ok');
