# Coast Live

An animated pixel-art wallpaper whose sky follows the real sun. Five scenes (Coast, Golden Dunes,
Sandstone Plateau, Desert Oasis, Amman) with drifting clouds, waves, swaying grass and palms, a moon and stars at
night. It works offline and finds the sun from your time zone, or from coordinates you enter.

It runs on **GNOME Shell**, **KDE Plasma 6** and **Android**, from one shared core.

| Scene | Animated details |
| --- | --- |
| Coast | Cloud drift, waves, swaying grass |
| Golden Dunes | Cloud drift, windblown sand |
| Sandstone Plateau | Cloud drift, dust, swaying dry grass |
| Desert Oasis | Cloud drift, swaying palms and reeds, water reflections |
| Amman | Cloud drift, the Jordanian flag waving on its pole (Citadel, Roman Theater and King Abdullah Mosque in the skyline) |

## How it is built

```
core/      Platform-independent JavaScript: solar clock, sky generator, scene painting.
           No I/O, no platform APIs. The single source of truth.
gnome/     GNOME Shell extension  - thin shell around core/ (Cairo, GdkPixbuf, GSettings)
kde/       Plasma 6 wallpaper     - native QML scene (gradients + sprites + items), core imported as .mjs
android/   Android app            - Java port of core/ (android/core) + Android shell (android/app)
assets/    Terrain art (ground/palm layers, lit stills) and time-zone data
art-source/  Concept art the terrain layers are cut from (not shipped)
tools/     Build scripts and art generation        tests/   Verification (see below)
```

Every scene is drawn on a 960x540 pixel grid and scaled to the screen. The sky is **computed**, not stored:
`core/sky.js` blends seven colour palettes and draws the sun, moon and stars for any of 2,000 lighting
frames. (The first version shipped these as 2,000 pre-rendered 1080p JPEGs, 123 MB.) Clouds, water, grass and
dust are drawn through a tiny `paint` interface (`color`, `rectangle`, `fill`, `clip` ...), so the identical
drawing code runs on Cairo and Android Canvas.

Android cannot run the JavaScript, so `android/core` is a line-for-line Java port, kept honest by
`tests/` which compares it against the JavaScript core (see *Verification*).

### Size

| | Before (v4) | Now |
| --- | --- | --- |
| GNOME extension zip | 74 MB | 3.1 MB |
| Android APK | 22 MB (80 videos) | 1.0 MB |
| KDE Plasma package | - | 1.0 MB |

## Install

Build first (see below), then:

**GNOME Shell 45-51**

```sh
gnome-extensions install --force dist/coast-live.shell-extension.zip
```
Log out and back in, then `gnome-extensions enable coast-live@coastlive`. Settings: `gnome-extensions prefs coast-live@coastlive`.

**KDE Plasma 6**

```sh
kpackagetool6 -t Plasma/Wallpaper -i dist/kde/org.coastlive.wallpaper      # -u to upgrade
```
Right-click the desktop -> *Configure Desktop and Wallpaper* -> Wallpaper type **Coast Live**.
**Try it in a normal window first**, which cannot affect your desktop: `qml6 tests/kde-window.qml -- coast`.

**Android 7.0+**: copy `dist/coast-live.apk` to the phone and open it (allow installs from this source), open
**Coast Live**, pick a scene, tap **Set wallpaper**. Swiping between home screens pans the scene.

## Time of day and weather

**Time of day.** By default the sky follows the real sun. In the settings you can instead *choose a time* (for example to
keep a favourite sunset): the scene then shows that time of day at your location, every day.

**Weather** (off by default). Rain, snow, fog, overcast skies and thunderstorms (with lightning) can be drawn over any
scene. Pick a fixed weather (works fully offline), or **Match the real weather**: then the wallpaper asks
[Open-Meteo](https://open-meteo.com) (free, no account) every 30 minutes for the current conditions at your location.
**Privacy:** this is the only network use in the whole project. A request carries your approximate position rounded to
0.1 degree (about 11 km) and nothing else; in every other mode nothing is ever sent. Rain and snow are drawn once and
scrolled by the GPU (GNOME, KDE) so they cost almost nothing; fog and overcast are tinted bands over the picture.
On Android the weather needs the INTERNET permission, which the app only uses in that mode.

## Location and the sun

By default the sun follows your **system time zone**, using the zone's representative city from the IANA
database (`Asia/Shanghai` uses Shanghai). For a more exact sunrise/sunset in another city of the same zone,
enter **custom coordinates** in the GNOME or KDE settings. Unknown zones fall back to an estimate from the clock
offset. Polar day and night have special lighting sequences. Sun and moon paths are artistic, not astronomical.

## Build

| Target | Command | Needs |
| --- | --- | --- |
| GNOME | `tools/build-gnome.sh` -> `dist/coast-live.shell-extension.zip` | `glib-compile-schemas`, `zip` |
| KDE | `tools/build-kde.sh` -> `dist/kde/org.coastlive.wallpaper` | `node`, `zip` |
| Android | `tools/build-android.sh` -> `dist/coast-live.apk` | JDK 17+, `node`, Android `android.jar` + build-tools (see script header) |

The Android build is Gradle-free (`aapt2` -> `javac` -> `d8` -> `zipalign` -> `apksigner`) and signs with a
local, git-ignored `android/debug.keystore` created on first use.

**Regenerating art.** `tools/build-amman.py` rebuilds the Amman layers from `art-source/amman.png` and `amman-night.png` (the sky is cut away, the flag erased and the night picture blended in at dusk so the windows light up; the
flag is drawn by `core/flag.js`). `tools/build-sahara.py art-source/dunes.png art-source/plateau.png art-source/oasis.png`
rebuilds the Sahara terrain layers and lit stills (needs Python with numpy, scipy, Pillow, and Node for the sky).
`tools/render-frame.mjs FRAME` dumps one raw sky frame; `gjs -m tools/render-scene.js THEME FRAME ELAPSED out.png`
renders a complete scene with the GNOME code path.

## Verification

`tests/run-all.sh` runs everything that can be checked on a desktop (about 95 s):

* The Java port against the JavaScript core: lighting for all 2,000 frames, coastline, cloud masks, solar frames
  at 400 instants/places, time-zone lookup, and 23 million sky pixel values (identical).
* The **GNOME (Cairo) and Java renderers** agree on six scenes at several times of day (mean difference
  0.04-0.16 of 255); the **QML scene** is close (0.2-1.6 of 255; it uses gradients and sprites, not per-pixel images).
* **Time of day and weather**: the chosen-time frames, every weather code and the Open-Meteo parser (`tests/fixed-time.mjs`,
  `tests/weather.mjs`), and the Java port against the JavaScript on the same reports.
* The **KDE scene stays light**: `tests/kde-perf.sh` runs it with Qt's software renderer (no GPU, so
  pessimistic) and requires under 25% of one core (measured 6-9%) and no script errors.
* The GNOME extension loads and runs in an isolated, **headless GNOME Shell** for all four scenes.
* The sky agrees with the original pre-rendered frames to 0.7/255 mean (JPEG noise):
  `tests/sky-vs-legacy.mjs` (needs the old `scene-data.json` from the v4 zip on `main`).

### KDE design (and why)

A first KDE version drew the animated layers with QML's JavaScript `Canvas` and **froze plasmashell**: handing pixels
to a Canvas costs about 12 microseconds per pixel and each draw call about 2 ms, so one repaint took 6-8 s (99% CPU).
The current scene follows the same idea as Wallpaper Engine: **a few cheap pieces, animated by the GPU**.

* sky, sea and meadow are gradients, recoloured when the lighting frame changes (about every 30 s);
* sun glow, moon, clouds and grass tufts are small PNG sprites, rebuilt only when the light changes (queued, a few ms
  per tick at most) and then moved, rotated and faded by QML;
* ripples, waves and dust are plain rectangles repositioned every tick (about 1 ms of script);
* the Sahara terrain is the same pre-lit images, cross-faded by opacity.

### What is not verified

* **Android on a device or emulator.** The APK builds, is signed and its manifest is valid, and all its logic is
  tested through the Java core; but the Android `Canvas`/`WallpaperService` glue has not been run.
* **KDE inside a live plasmashell.** The scene is tested offscreen (software renderer); `main.qml`/`config.qml` pass
  `qmllint` and import modules present on Plasma 6, but were not loaded into a running desktop. The time zone comes
  from Plasma's `time` data engine (falls back to the clock offset).
* **GNOME 45-50.** Tested headless on GNOME 51 only; the extension uses the same APIs as v4.
* **Weather on GNOME and KDE in a live session.** The weather drawing is checked against the other renderers and the
  extension loads with every weather setting, but I have not watched rain fall on a real GNOME desktop. The live fetch
  was tested (`tests/weather-live.sh`), the Plasma and Android fetches were not.

## Licensing and credits

GPL-2.0-or-later, see `COPYING`. Time-zone locations and aliases come from the public-domain
[IANA time-zone database](https://www.iana.org/time-zones); the solar approximation uses
[NOAA's solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). The Sahara scenery is cut from the
original concept art in `art-source/`; the coastal sky and clouds are procedural.

For the GNOME Extensions directory, see its
[review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) (the directory applies
its own policy to AI-generated code) and the submission page at <https://extensions.gnome.org/upload/>.
