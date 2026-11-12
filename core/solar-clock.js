// SPDX-License-Identifier: GPL-2.0-or-later
const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
const RAD = Math.PI / 180;
const HORIZON = -0.833;
const CIVIL_TWILIGHT = -6;

function solarTerms(timestamp) {
    const year = new Date(timestamp).getUTCFullYear();
    const jan1 = Date.UTC(year, 0, 1);
    const days = (Date.UTC(year + 1, 0, 1) - jan1) / DAY;
    const angle = 2 * Math.PI / days * ((timestamp - jan1) / DAY - 0.5);
    const equation = 229.18 * (
        0.000075 + 0.001868 * Math.cos(angle) - 0.032077 * Math.sin(angle)
        - 0.014615 * Math.cos(2 * angle) - 0.040849 * Math.sin(2 * angle)
    );
    const declination = 0.006918 - 0.399912 * Math.cos(angle) + 0.070257 * Math.sin(angle)
        - 0.006758 * Math.cos(2 * angle) + 0.000907 * Math.sin(2 * angle)
        - 0.002697 * Math.cos(3 * angle) + 0.00148 * Math.sin(3 * angle);
    return [equation, declination];
}

function solarNoon(utcMidnight, longitude) {
    const base = utcMidnight + (720 - 4 * longitude) * MINUTE;
    let time = base;
    for (let i = 0; i < 3; i++)
        time = base - solarTerms(time)[0] * MINUTE;
    return time;
}

export function solarAltitude(time, latitude, longitude) {
    const [equation, declination] = solarTerms(time);
    const trueSolarMinutes = (time % DAY) / MINUTE + equation + 4 * longitude;
    const hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
    const latitudeRadians = latitude * RAD;
    const sine = Math.sin(latitudeRadians) * Math.sin(declination)
        + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
    return Math.asin(Math.max(-1, Math.min(1, sine))) / RAD;
}

function crossing(from, to, elevation, threshold) {
    const before = elevation(from) >= threshold;
    if (before === (elevation(to) >= threshold))
        return null;

    // Half-second precision is finer than the wallpaper frame interval.
    while (to - from > 500) {
        const middle = (from + to) / 2;
        if ((elevation(middle) >= threshold) === before)
            from = middle;
        else
            to = middle;
    }
    return (from + to) / 2;
}

export function solarSchedule(time, latitude, longitude) {
    let day = Math.floor((time + longitude * 4 * MINUTE) / DAY) * DAY;
    const boundary = utcDay => (solarNoon(utcDay - DAY, longitude) + solarNoon(utcDay, longitude)) / 2;
    if (time < boundary(day))
        day -= DAY;
    else if (time >= boundary(day + DAY))
        day += DAY;

    const start = boundary(day);
    const noon = solarNoon(day, longitude);
    const end = boundary(day + DAY);
    const elevation = timestamp => solarAltitude(timestamp, latitude, longitude);
    const noonAltitude = elevation(noon);
    const sunrise = noonAltitude >= HORIZON ? crossing(start, noon, elevation, HORIZON) : null;
    const sunset = noonAltitude >= HORIZON ? crossing(noon, end, elevation, HORIZON) : null;
    const dawn = sunrise === null ? null : crossing(start, sunrise, elevation, CIVIL_TWILIGHT);
    const dusk = sunset === null ? null : crossing(sunset, end, elevation, CIVIL_TWILIGHT);
    let mode = 'regular';
    let anchors;

    if (sunrise === null && sunset === null) {
        if (noonAltitude >= HORIZON) {
            mode = 'polar-day';
            anchors = [[start, 650], [noon, 1000], [end, 650]];
        } else {
            mode = 'polar-night';
            const twilightFrame = noonAltitude >= CIVIL_TWILIGHT ? 357 : 227;
            anchors = [[start, 0], [noon, twilightFrame], [end, 0]];
        }
    } else {
        anchors = [
            [start, sunrise === null ? 650 : 0],
            [dawn, 360],
            [sunrise, 440],
            [noon, 1000],
            [sunset, 1560],
            [dusk, 1640],
            [end, sunset === null ? 650 : 2000],
        ].filter(([timestamp]) => timestamp !== null);
    }
    return { start, end, noon, dawn, sunrise, sunset, dusk, mode, anchors };
}

export function solarFrame(time, schedule) {
    const { anchors } = schedule;
    for (let i = 1; i < anchors.length; i++) {
        const [after, last] = anchors[i];
        if (time <= after) {
            const [before, first] = anchors[i - 1];
            const progress = Math.max(0, (time - before) / (after - before));
            return Math.min(1999, Math.floor(first + progress * (last - first)));
        }
    }
    return Math.min(1999, anchors.at(-1)[1]);
}
