# Coast Live Worlds

GNOME extension version **15** and **Coast Live Worlds 1.3** for Android offer 24 animated wallpapers with local sunlight, full-frame weather, searchable playlists, and an offline city picker.

The wallpapers combine illustrated terrain with a live sky, a circular sun, lunar phases, and animated details. Twenty terrain illustrations are **1672 × 941**, and the seven shared sky plates are **1920 × 1080**. The renderer scales and crops the artwork proportionally to fill the screen.

This release removes the **Season** setting and the combined effects toggle. Seasonal recoloring, lingering rain and snow, moving shadow overlays, and scheduled rare events have been removed.

## GNOME installation

The extension keeps the ID `coast-live@coastlive` and existing settings. Save the release ZIP in Downloads, then run as your desktop user:

```sh
gnome-extensions disable coast-live@coastlive
gnome-extensions install --force ~/Downloads/coast-live-layered.shell-extension.zip
```

**Sign out and sign back in**, then run:

```sh
gnome-extensions enable coast-live@coastlive
gnome-extensions info coast-live@coastlive
gnome-extensions prefs coast-live@coastlive
```

Check for **Version: 15** and **State: ACTIVE**. Under **Scene → Wallpaper**, the list now has 24 entries. The extension declares GNOME Shell 45–50 compatibility. A live Shell session on each of those releases has not been tested for this release.

Keep your previous release ZIP for rollback. To restore it, disable this version, install the older ZIP with `--force`, sign out and back in, and enable it. Select an original scene before rolling back to a version that has only four scenes.

## Android installation

1. Download **coast-live-worlds.apk** to your phone or tablet.
2. Open it and allow installation from that file source if Android asks.
3. Open **Coast Live Worlds**, choose a scene and settings, and tap **Set wallpaper**.
4. Choose the destinations offered by Android's wallpaper preview.

This APK uses **`org.coastlive.worlds`** and the existing Coast Live Worlds certificate. Install it over 1.0, 1.1, or 1.2 to keep your settings. The older **Coast Live Layers** app (`org.coastlive.layers`) is a separate app.

Requires Android 7.0+ and live-wallpaper support. Device vendors decide which home/lock-screen destinations are available. The app requests Internet permission for optional Live Weather and no location permission.

## Features shared by all scenes

- **Local sunlight:** choose a city from the offline picker, use the approximate location from the system time zone, or enter coordinates. The scene you choose does not change your coordinates.
- **Sun and moon layers:** the sun is drawn as a geometrical circle. Its vertical position changes with the scene horizon without stretching the disk. The moon's disk is also unstretched, while its visible shape follows the lunar calendar. The default sky uses artistic paths. Enable **Observed sky** for a location-based Moon position and visible constellations. Scenery naturally occludes them.
- **Time controls:** preview any minute, keep a fixed time, or return to the local clock. Foreground motion continues at fixed time. The lunar phase follows the local date.
- **Manual weather:** Clear, Overcast, Foggy, and Stormy work offline. Clouds, wind, illumination, mist, precipitation, and water movement respond together where appropriate to the scene.
- **Live Weather:** uses the solar coordinates, rounded to two decimals, with Open-Meteo. Conditions refresh every 15 minutes while needed; failed requests retry after five minutes. Cached readings expire after 90 minutes from the provider timestamp, then Clear is used. Weather remains current when previewing a different hour.
- **Night lighting:** selected lanterns, windows, and lava retain an independent light layer at night. Water scenes include sun/moon-driven glints; full moonlight strengthens those glints.
- **Frame-rate choices:** GNOME 8/15/25/50 FPS; Android 15/24/30/50 FPS. These are requested rates, not guaranteed performance. Android Battery Saver caps animation at 15 FPS. Quiet mode can cap it at 8 FPS, and the wallpaper animation pauses when Android marks it hidden.
- **GNOME Appearance:** Match GNOME background generates a composed still at most once per minute, with an immediate update when changing scene or fixing a new time. It supports all 24 scenes, including the corrected Sahara sun. Background restoration and manual-wallpaper priority are retained. The Activities/Appearance image is a still.
- **Display support:** proportional desktop monitor layouts, Android portrait/landscape, and phone/tablet screen shapes. Portrait crops the wide illustration; it does not squeeze it into a narrow image.

Fog and storm lighting cover the full scene. In Underwater Kelp Cathedral, weather also changes the filtered surface light and plant motion. In Autumn Bookshop Window, rain and snow remain visible through the window. Names such as “Rainy” and “Moonlit” describe the concept: choose weather and time settings to reproduce that mood.

## Living Worlds controls

| Setting | Behavior |
| --- | --- |
| Observed sky | The Moon follows an offline coordinate-based 2020–2080 ephemeris with a topocentric correction. Clear nights can show Orion, the Big Dipper, Cassiopeia, and the Southern Cross where they are above the horizon. The default artistic mode remains available. |
| Quiet mode | Dims the wallpaper. GNOME throttles animation behind full-screen apps or on battery when the system exposes battery state. Android targets 8 FPS when unplugged in Quiet mode and uses the platform’s wallpaper visibility signal. |
| Framing (Android) | Each scene has a portrait focal point. Choose a phone or tablet preview aspect and adjust the horizontal offset to match your layout. Framing uses proportional cropping of the existing illustration. |
| Multiple monitors (GNOME) | Mirror your active scene, choose a wallpaper from each monitor’s searchable dropdown, or span a continuous composition over the display layout. GNOME’s Appearance still uses the active scene. |

### Solar location

In GNOME preferences, expand **Solar location → Choose a city**. On Android, tap **Solar location → Change location → Choose a country and city**. Search the country, then choose a state, province, or governorate, and then a city. For example, select United States → California → Los Angeles, or Jordan → All regions → Amman. Small country lists can be searched across all regions.

Coast Live uses the city coordinates for sun and moon calculations and, when enabled, live weather. The system clock continues to set playlist times. The bundled GeoNames snapshot contains 4,980,783 active populated places in 252 countries and territories. Data coverage depends on what is recorded by GeoNames. Enter coordinates for a place missing from the catalog. Searching the offline catalog makes no network request.

### Playlists

Open **Living worlds → Scene playlist** on GNOME or **Edit scene playlist** on Android. Add a time, weather, or favorites rule. Open **Wallpapers**, search the scene names, and check one or more. Coast Live cycles between the selected scenes by day when that rule applies.

A matching weather rule wins. Otherwise Coast Live follows the latest scheduled rule, wrapping to the previous evening before the first rule of the day. Favorites apply when there is no scheduled match. Removing all rules uses your manual wallpaper selection.

In GNOME's **Separate scenes** mode, choose one fixed wallpaper per monitor or choose **Follow active scene or playlist**. Your existing monitor selections and playlist rules carry over into these controls.

### Scene editor and cross-platform packs

Open **Scene pack → Editor** in GNOME preferences, or extract and open `editor/coast-live-scene-editor.html` in your browser. The editor runs offline. Add 16:9 sky, terrain, and foreground art. The terrain is required. Use transparency in the terrain and foreground to expose the animated sky. Optionally mark a water polygon for reflections, lanterns, and the portrait focal point.

Export a `.coast.json` file and import it through **Scene pack → Import** in GNOME or **Import scene pack** in Android. The same file works on both. A pack occupies one of the 24 built-in slots while installed. Remove it to restore that slot’s original art. The editor accepts one pack at a time and exports layers at 1920 × 1080, up to 12 MB for the complete pack.

## Scene list

| Scene | Independent animated details |
| --- | --- |
| Coast | Clouds, water, grass, seabirds, foam, reflections |
| Golden Dunes | Clouds, wind-driven sand |
| Sandstone Plateau | Clouds, dust, grass |
| Desert Oasis | Water, reeds, palms, dusk fireflies, reflections |
| Lantern Train in the Pines | Moving train, steam, drifting leaves, small plants |
| Rainy Ramen Alley | Steam, petals, puddle ripples and glints |
| Alpine Mirror Lake | Lake ripples, reflections, cabin smoke, leaves |
| Moonlit Bamboo Shrine | Small wind-driven foliage, fireflies, lantern lighting |
| Lavender Windmill Fields | Turning blades, flower stalks, drifting petals |
| Aurora Ice Harbor | Moving nighttime aurora ribbons, water glints |
| Mushroom Creek | Creek glints, leaves, small plants, fireflies |
| Volcanic Observatory | Rising embers, smoke, nighttime lava lighting |
| Dead Sea Salt Shore | Wind-responsive water glints and light dust |
| Petra by Lanternlight | Drifting dust and lantern lighting |
| Amman Rooftops | Drifting olive leaves, small plants, lantern lighting |
| Jerash After Rain | Puddle glints, rain splashes, dust |
| Underwater Kelp Cathedral | Fish, rising bubbles, light shafts, small swaying kelp |
| Floating Garden Islands | Falling water highlights, leaves, small plants |
| Midnight Space Greenhouse | Dust and greenhouse lighting, a decorative ringed planet |
| Cherry Blossom Canal | Falling petals, canal ripples, light reflections |
| Autumn Bookshop Window | Drifting outdoor leaves, cup steam, lamp lighting |
| Thunder Over the Prairie | Turning wind pump and swaying foreground stalks; select Stormy for rain |
| Glowing Mangrove River | Bioluminescent water glints, fireflies, small plants |
| Snowbound Mountain Inn | Chimney smoke and window lighting; live weather can add snowfall |

The detailed base illustrations are stationary. Named effects, sky, weather, and celestial layers animate independently; not every painted object is a separate animated sprite.

## Validation and limits

All 32 Android host tests passed on API 28 and 35, covering 384 scene, weather, and orientation renders. GNOME lifecycle tests covered 96 scene and weather combinations across two simulated monitors. Native Cairo verified full-frame fog, storm, and snow lighting for all 24 scenes. See `TEST-REPORT.md` in the source archive for test details and limits. Physical phones, live GNOME Shell sessions, and sustained frame rates still need device testing.

## Build and maintain

The GNOME ZIP is readable source. Extract it, change files, compile schemas with `glib-compile-schemas --strict schemas`, then package the directory contents with `zip -r ../coast-live-layered.shell-extension.zip .`. Keep `metadata.json` at the ZIP root.

The complete source ZIP contains both projects, shared artwork, source tests, and Android `build.sh`. Restore the shared assets using the instructions below, then change into `android/coast-live-android`. Install JDK 17+, Android SDK Platform 35 and Build-Tools 35.0.0, Bash, and ZIP. Build with your retained keystore:

```sh
export ANDROID_HOME=/path/to/android-sdk
bash build.sh /path/to/coast-worlds.p12 coast-live-worlds.apk
```

The separate **private signing backup** contains this release's key and password for future updates. Keep it private and retain it. It is deliberately omitted from the app, GNOME extension, and public source archives. An APK signed with another key cannot update this installation in place.

Generated art prompts are retained in `ART-PROMPTS.json`. `data/living-worlds.json` records the portrait focal point for each scene. `tools/build-moon-positions.cjs` regenerates the ephemeris using Astronomy Engine 2.1.19. The catalog in `data/worlds.json` defines effect placement and light-source samples. GNOME's `world-catalog.js` mirrors that data; Android reads the JSON directly. The original solar, moon-phase, location, weather, and preset modules remain shared in behavior.

## Weather and location attribution

The offline place catalog contains adapted [GeoNames](https://www.geonames.org/export/) data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The release generator filters populated-place records, rounds coordinates to five decimal places, and groups names by region. See `data/places/ATTRIBUTION.txt` in the GNOME source.

Weather data by [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See the [API documentation](https://open-meteo.com/en/docs) and [terms of use](https://open-meteo.com/en/terms).

The project retains GPL-2.0-or-later licensing; see `COPYING`. New terrain illustrations were generated for this project and are included with the same project distribution terms. IANA location data is public domain. The moon-phase and geocentric Moon position tables are derived using [Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy), distributed under the MIT license.

### Complete source archive

`coast-live-worlds-source.zip` contains both platform projects and the verification scripts. To avoid downloading the same illustrations twice, Android's identical assets are stored once in the GNOME tree. After extraction, run this from the archive root before building Android:

```sh
python3 tools/prepare-assets.py
```

Then use `android/coast-live-android/build.sh` and the verification instructions in `tests/README.md`.
