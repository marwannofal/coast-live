// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import java.util.ArrayList;
import java.util.List;

/** Sun position and the day's lighting schedule. Mirrors core/solar-clock.js (NOAA solar equations). */
public final class SolarClock {
    private SolarClock() {}

    private static final double MINUTE = 60_000;
    private static final double DAY = 1440 * MINUTE;
    private static final double RAD = Math.PI / 180;
    private static final double HORIZON = -0.833;
    private static final double CIVIL_TWILIGHT = -6;

    // ---- calendar arithmetic without java.time (not available before Android 8)
    private static long daysFromCivil(long y, int m, int d) {
        y -= m <= 2 ? 1 : 0;
        long era = (y >= 0 ? y : y - 399) / 400;
        long yoe = y - era * 400;
        long doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
        long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    private static long utcYear(long ms) {
        long z = Math.floorDiv(ms, 86_400_000L) + 719468;
        long era = (z >= 0 ? z : z - 146096) / 146097;
        long doe = z - era * 146097;
        long yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        long y = yoe + era * 400;
        long doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        long mp = (5 * doy + 2) / 153;
        int m = (int) (mp < 10 ? mp + 3 : mp - 9);
        return y + (m <= 2 ? 1 : 0);
    }

    private static double utcJan1(long year) { return daysFromCivil(year, 1, 1) * 86_400_000.0; }

    private static double[] solarTerms(double timestamp) {
        long year = utcYear((long) timestamp);
        double jan1 = utcJan1(year);
        double days = (utcJan1(year + 1) - jan1) / DAY;
        double angle = 2 * Math.PI / days * ((timestamp - jan1) / DAY - 0.5);
        double equation = 229.18 * (0.000075 + 0.001868 * Math.cos(angle) - 0.032077 * Math.sin(angle)
                - 0.014615 * Math.cos(2 * angle) - 0.040849 * Math.sin(2 * angle));
        double declination = 0.006918 - 0.399912 * Math.cos(angle) + 0.070257 * Math.sin(angle)
                - 0.006758 * Math.cos(2 * angle) + 0.000907 * Math.sin(2 * angle)
                - 0.002697 * Math.cos(3 * angle) + 0.00148 * Math.sin(3 * angle);
        return new double[] {equation, declination};
    }

    private static double solarNoon(double utcMidnight, double longitude) {
        double base = utcMidnight + (720 - 4 * longitude) * MINUTE;
        double time = base;
        for (int i = 0; i < 3; i++) time = base - solarTerms(time)[0] * MINUTE;
        return time;
    }

    public static double solarAltitude(double time, double latitude, double longitude) {
        double[] t = solarTerms(time);
        double trueSolarMinutes = mod(time, DAY) / MINUTE + t[0] + 4 * longitude;
        double hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
        double lat = latitude * RAD;
        double sine = Math.sin(lat) * Math.sin(t[1]) + Math.cos(lat) * Math.cos(t[1]) * Math.cos(hourAngle);
        return Math.asin(Math.max(-1, Math.min(1, sine))) / RAD;
    }

    private static double mod(double a, double b) { double r = a % b; return r < 0 ? r + b : r; }  // JS % keeps the sign; times here are positive

    private interface Elevation { double at(double timestamp); }

    private static double crossing(double from, double to, Elevation elevation, double threshold) {
        boolean before = elevation.at(from) >= threshold;
        if (before == (elevation.at(to) >= threshold)) return Double.NaN;
        while (to - from > 500) {
            double middle = (from + to) / 2;
            if ((elevation.at(middle) >= threshold) == before) from = middle; else to = middle;
        }
        return (from + to) / 2;
    }

    /** One (timestamp, frame) waypoint of the day. */
    public static final class Anchor {
        public final double time; public final int frame;
        Anchor(double time, int frame) { this.time = time; this.frame = frame; }
    }

    public static final class Schedule {
        public double start, end, noon, dawn, sunrise, sunset, dusk;
        public String mode = "regular";
        public List<Anchor> anchors = new ArrayList<>();
    }

    public static Schedule solarSchedule(double time, double latitude, double longitude) {
        double day = Math.floor((time + longitude * 4 * MINUTE) / DAY) * DAY;
        if (time < boundary(day, longitude)) day -= DAY;
        else if (time >= boundary(day + DAY, longitude)) day += DAY;

        final double lat = latitude, lon = longitude;
        Schedule s = new Schedule();
        s.start = boundary(day, lon);
        s.noon = solarNoon(day, lon);
        s.end = boundary(day + DAY, lon);
        Elevation elevation = ts -> solarAltitude(ts, lat, lon);
        double noonAltitude = elevation.at(s.noon);
        s.sunrise = noonAltitude >= HORIZON ? crossing(s.start, s.noon, elevation, HORIZON) : Double.NaN;
        s.sunset = noonAltitude >= HORIZON ? crossing(s.noon, s.end, elevation, HORIZON) : Double.NaN;
        s.dawn = Double.isNaN(s.sunrise) ? Double.NaN : crossing(s.start, s.sunrise, elevation, CIVIL_TWILIGHT);
        s.dusk = Double.isNaN(s.sunset) ? Double.NaN : crossing(s.sunset, s.end, elevation, CIVIL_TWILIGHT);

        if (Double.isNaN(s.sunrise) && Double.isNaN(s.sunset)) {
            if (noonAltitude >= HORIZON) {
                s.mode = "polar-day";
                s.anchors.add(new Anchor(s.start, 650)); s.anchors.add(new Anchor(s.noon, 1000)); s.anchors.add(new Anchor(s.end, 650));
            } else {
                s.mode = "polar-night";
                int twilightFrame = noonAltitude >= CIVIL_TWILIGHT ? 357 : 227;
                s.anchors.add(new Anchor(s.start, 0)); s.anchors.add(new Anchor(s.noon, twilightFrame)); s.anchors.add(new Anchor(s.end, 0));
            }
        } else {
            s.anchors.add(new Anchor(s.start, Double.isNaN(s.sunrise) ? 650 : 0));
            if (!Double.isNaN(s.dawn)) s.anchors.add(new Anchor(s.dawn, 360));
            if (!Double.isNaN(s.sunrise)) s.anchors.add(new Anchor(s.sunrise, 440));
            s.anchors.add(new Anchor(s.noon, 1000));
            if (!Double.isNaN(s.sunset)) s.anchors.add(new Anchor(s.sunset, 1560));
            if (!Double.isNaN(s.dusk)) s.anchors.add(new Anchor(s.dusk, 1640));
            s.anchors.add(new Anchor(s.end, Double.isNaN(s.sunset) ? 650 : 2000));
        }
        return s;
    }

    private static double boundary(double utcDay, double longitude) {
        return (solarNoon(utcDay - DAY, longitude) + solarNoon(utcDay, longitude)) / 2;
    }

    public static int solarFrame(double time, Schedule schedule) {
        List<Anchor> a = schedule.anchors;
        for (int i = 1; i < a.size(); i++) {
            double after = a.get(i).time;
            int last = a.get(i).frame;
            if (time <= after) {
                double before = a.get(i - 1).time;
                int first = a.get(i - 1).frame;
                double progress = Math.max(0, (time - before) / (after - before));
                return (int) Math.min(1999, Math.floor(first + progress * (last - first)));
            }
        }
        return Math.min(1999, a.get(a.size() - 1).frame);
    }

    /** The frame for a chosen time of day (minutes after local midnight today) instead of the real clock. */
    public static int fixedTimeFrame(Tracker tracker, long now, int minutes, double lat, double lon) {
        java.util.Calendar midnight = java.util.Calendar.getInstance();
        midnight.setTimeInMillis(now);
        midnight.set(java.util.Calendar.HOUR_OF_DAY, 0);
        midnight.set(java.util.Calendar.MINUTE, 0);
        midnight.set(java.util.Calendar.SECOND, 0);
        midnight.set(java.util.Calendar.MILLISECOND, 0);
        return tracker.frameAt(midnight.getTimeInMillis() + minutes * 60_000.0, lat, lon);
    }

    /** Keeps today's schedule so that asking for the frame every few seconds is cheap. */
    public static final class Tracker {
        private Schedule schedule;
        private double latitude = Double.NaN, longitude = Double.NaN;

        public int frameAt(double time, double lat, double lon) {
            if (schedule == null || time < schedule.start || time >= schedule.end || lat != latitude || lon != longitude) {
                schedule = solarSchedule(time, lat, lon);
                latitude = lat;
                longitude = lon;
            }
            return solarFrame(time, schedule);
        }
    }
}
