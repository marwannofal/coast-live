// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.core;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Time-zone to coordinates lookup. Mirrors core/zones.js. Inputs are the text of zone.tab / zone-links.txt. */
public final class Zones {
    private Zones() {}

    private static double parseAngle(String value, int degreeDigits) {
        int sign = value.charAt(0) == '-' ? -1 : 1;
        double degrees = Double.parseDouble(value.substring(1, 1 + degreeDigits));
        double minutes = Double.parseDouble(value.substring(1 + degreeDigits, 3 + degreeDigits));
        String rest = value.substring(3 + degreeDigits);
        double seconds = rest.isEmpty() ? 0 : Double.parseDouble(rest);
        return sign * (degrees + minutes / 60 + seconds / 3600);
    }

    private static final Pattern COORDS = Pattern.compile("^([+-]\\d{4}(?:\\d{2})?)([+-]\\d{5}(?:\\d{2})?)$");

    public static Map<String, double[]> parseZoneTable(String text) {
        Map<String, double[]> zones = new HashMap<>();
        for (String line : text.split("\n", -1)) {
            if (line.startsWith("#") || line.trim().isEmpty()) continue;
            String[] parts = line.split("\t", -1);
            if (parts.length < 3) continue;
            Matcher m = COORDS.matcher(parts[1]);
            if (m.matches() && !parts[2].isEmpty())
                zones.put(parts[2].trim(), new double[] {parseAngle(m.group(1), 2), parseAngle(m.group(2), 3)});
        }
        return zones;
    }

    private static final Pattern LINK = Pattern.compile("^(?:L|Link)\\s+(\\S+)\\s+(\\S+)");

    public static Map<String, String> parseZoneLinks(String text) {
        Map<String, String> aliases = new HashMap<>();
        for (String line : text.split("\n", -1)) {
            Matcher m = LINK.matcher(line);
            if (m.find()) aliases.put(m.group(2), m.group(1));
        }
        return aliases;
    }

    public static String normalizeZoneName(String id) {
        return id.replaceFirst("^:", "").replaceFirst("^.*/zoneinfo/", "").replaceFirst("^(?:posix|right)/", "");
    }

    public static double[] coordinatesForZone(Map<String, double[]> zones, Map<String, String> links, String id) {
        String name = normalizeZoneName(id);
        Set<String> visited = new HashSet<>();
        while (name != null && !name.isEmpty() && !visited.contains(name)) {
            double[] c = zones.get(name);
            if (c != null) return c;
            visited.add(name);
            name = links.get(name);
        }
        return null;
    }

    public static double[] coordinatesForOffset(int offsetSeconds) {
        double longitude = ((offsetSeconds / 240.0 + 180) % 360 + 360) % 360 - 180;
        return new double[] {0, longitude};
    }

    /** Best-effort coordinates for a zone: its representative city, or an estimate from the clock offset. */
    public static double[] resolveCoordinates(Map<String, double[]> zones, Map<String, String> links, String zoneName, int offsetSeconds) {
        double[] c = coordinatesForZone(zones, links, zoneName);
        return c != null ? c : coordinatesForOffset(offsetSeconds);
    }
}
