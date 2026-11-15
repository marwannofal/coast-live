// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import org.coastlive.core.Config;
import org.coastlive.core.Shapes;
import org.coastlive.core.Sky;
import org.coastlive.core.SolarClock;
import org.coastlive.core.Weather;
import org.coastlive.core.Zones;

/** Checks the Java port against reference data written by tests/android-golden.mjs. */
public final class GoldenTest {
    static int failures = 0;

    static void check(boolean ok, String what) {
        System.out.println((ok ? "PASS  " : "FAIL  ") + what);
        if (!ok) failures++;
    }

    public static void main(String[] args) throws IOException {
        Path golden = Paths.get(args[0]);
        Path repo = Paths.get(args[1]);

        // --- lighting: all 2000 frames must be identical
        int bad = 0;
        for (String line : Files.readAllLines(golden.resolve("lighting.txt"))) {
            String[] p = line.split(" ");
            int f = Integer.parseInt(p[0]);
            Sky.Light l = Sky.lighting(f);
            int[] got = {l.sun[0], l.sun[1], l.sun[2], l.moon[0], l.moon[1], l.moon[2], l.sunlight[0], l.sunlight[1], l.sunlight[2],
                l.cloud[0], l.cloud[1], l.cloud[2], l.sea[0], l.sea[1], l.sea[2], l.grass[0], l.grass[1], l.grass[2], l.day};
            for (int i = 0; i < got.length; i++) if (got[i] != Integer.parseInt(p[i + 1])) { bad++; if (bad < 4) System.out.println("  lighting frame " + f + " field " + i + ": java " + got[i] + " js " + p[i + 1]); break; }
        }
        check(bad == 0, "lighting for all 2000 frames identical (" + bad + " mismatches)");

        // --- coastline and clouds
        String[] c = Files.readAllLines(golden.resolve("coast.txt")).get(0).split(" ");
        int cbad = 0;
        for (int x = 0; x < Config.WIDTH; x++) if (Shapes.COAST[x] != Integer.parseInt(c[x])) cbad++;
        check(cbad == 0, "coastline identical (" + cbad + " columns differ)");
        List<String> cloudLines = Files.readAllLines(golden.resolve("clouds.txt"));
        Shapes.CloudMask[] masks = Shapes.makeCloudMasks();
        for (int m = 0; m < masks.length; m++) {
            long sum = 0; int spans = 0;
            for (int tone = 0; tone < masks[m].groups.length; tone++) {
                int[] g = masks[m].groups[tone];
                spans += g.length / 3;
                for (int i = 0; i < g.length; i += 3) sum = (sum + (tone * 1000003L + g[i] * 31L + g[i + 1] * 17L + g[i + 2] * 7L)) % 1000000007L;
            }
            String[] e = cloudLines.get(m).split(" ");
            check(masks[m].w == Integer.parseInt(e[0]) && masks[m].h == Integer.parseInt(e[1]) && spans == Integer.parseInt(e[2]) && sum == Long.parseLong(e[3]),
                    "cloud mask " + m + " identical");
        }

        // --- solar frames
        int sbad = 0, n = 0;
        for (String line : Files.readAllLines(golden.resolve("solar.txt"))) {
            String[] p = line.split(" ");
            int expected = Integer.parseInt(p[3]);
            int got = new SolarClock.Tracker().frameAt(Double.parseDouble(p[0]), Double.parseDouble(p[1]), Double.parseDouble(p[2]));
            n++;
            if (Math.abs(got - expected) > 1) { sbad++; if (sbad < 4) System.out.println("  solar " + line + " java " + got); }
        }
        check(sbad == 0, "solar frame for " + n + " instants/places within 1 frame of JS (" + sbad + " off)");

        // --- weather: code mapping, layer counts and overcast/fog band alphas
        int wbad = 0, wn = 0;
        Sky.Light noon = Sky.lighting(1000);
        for (String line : Files.readAllLines(golden.resolve("weather.txt"))) {
            String[] p = line.split(" ");
            Weather x = Weather.fromCurrent(Integer.parseInt(p[0]), Double.parseDouble(p[1]), Double.parseDouble(p[2]));
            StringBuilder layers = new StringBuilder();
            for (Weather.Layer l : Weather.layers(x)) layers.append(layers.length() > 0 ? "," : "").append(l.count);
            if (layers.length() == 0) layers.append('-');
            double[][] bands = Weather.bands(noon, x);
            double worst = 0;
            String[] alphas = p[8].split(",");
            for (int i = 0; i < bands.length; i++) worst = Math.max(worst, Math.abs(bands[i][3] - Double.parseDouble(alphas[i])));
            wn++;
            boolean same = x.kind.equals(p[3]) && Math.abs(x.intensity - Double.parseDouble(p[4])) < 1e-9
                && Math.abs(x.cloud - Double.parseDouble(p[5])) < 1e-8 && Math.abs(x.wind - Double.parseDouble(p[6])) < 1e-8
                && layers.toString().equals(p[7]) && worst < 2e-6;
            if (!same) { wbad++; if (wbad < 4) System.out.println("  weather " + line.substring(0, Math.min(60, line.length())) + " java " + x.kind + " " + layers); }
        }
        check(wbad == 0, "weather for " + wn + " reports identical (" + wbad + " differ)");

        // --- zones
        Map<String, double[]> zones = Zones.parseZoneTable(new String(Files.readAllBytes(repo.resolve("assets/data/zone.tab")), "UTF-8"));
        Map<String, String> links = Zones.parseZoneLinks(new String(Files.readAllBytes(repo.resolve("assets/data/zone-links.txt")), "UTF-8"));
        int zbad = 0;
        for (String line : Files.readAllLines(golden.resolve("zones.txt"))) {
            String[] p = line.split(" ");
            double[] r = Zones.resolveCoordinates(zones, links, p[0], Integer.parseInt(p[1]));
            if (Math.abs(r[0] - Double.parseDouble(p[2])) > 1e-9 || Math.abs(r[1] - Double.parseDouble(p[3])) > 1e-9) { zbad++; System.out.println("  zone " + line + " java " + r[0] + "," + r[1]); }
        }
        check(zbad == 0, "time-zone lookup identical (" + zbad + " differ)");

        // --- sky pixels
        Sky.Renderer sky = new Sky.Renderer(Config.HEIGHT);
        byte[] out = new byte[sky.byteLength()];
        long maxDiff = 0, total = 0, over1 = 0; int worstFrame = -1;
        long t0 = System.nanoTime();
        int frames = 0;
        try (var files = Files.list(golden.resolve("frames"))) {
            for (Path f : (Iterable<Path>) files.sorted()::iterator) {
                int frame = Integer.parseInt(f.getFileName().toString().replace(".rgb", ""));
                byte[] ref = Files.readAllBytes(f);
                sky.renderFrame(frame, out);
                frames++;
                for (int i = 0; i < ref.length; i++) {
                    int d = Math.abs((ref[i] & 0xFF) - (out[i] & 0xFF));
                    total++;
                    if (d > 1) over1++;
                    if (d > maxDiff) { maxDiff = d; worstFrame = frame; }
                }
            }
        }
        System.out.printf("      sky: %d frames compared, max channel diff %d (frame %d), %d of %d values differ by more than 1%n", frames, maxDiff, worstFrame, over1, total);
        check(maxDiff <= 1, "sky pixels match the JavaScript renderer to within 1/255");
        System.out.printf("      Java sky render time (incl. plate builds): %.0f ms for %d frames%n", (System.nanoTime() - t0) / 1e6, frames);
        System.exit(failures == 0 ? 0 : 1);
    }
}
