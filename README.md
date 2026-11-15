# Coast Live Worlds

GNOME extension version **12** and Android **Coast Live Worlds 1.0** add the twenty selected pixel-art concepts to the original Coast, Golden Dunes, Sandstone Plateau, and Desert Oasis: **24 selectable scenes**.

The new scenes are illustrated terrain layers with a live sky, circular sun, phase-shaped moon, weather, and independent animated details. They are not video loops or collections of thousands of rendered frames. The twenty new transparent illustrations are **1672 × 941**; the seven existing shared sky plates are **1920 × 1080**. Artwork fills the screen with proportional cropping. This release does not claim native 4K artwork.

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

Check for **Version: 12** and **State: ACTIVE**. Under **Scene → Wallpaper**, the list now has 24 entries. The extension declares GNOME Shell 45–50 compatibility. A live Shell session on each of those releases has not been tested for this release.

Keep your previous release ZIP for rollback. To restore it, disable this version, install the older ZIP with `--force`, sign out and back in, and enable it. Select an original scene before rolling back to a version that has only four scenes.

## Android installation

1. Download **coast-live-worlds.apk** to your phone or tablet.
2. Open it and allow installation from that file source if Android asks.
3. Open **Coast Live Worlds**, choose a scene and settings, and tap **Set wallpaper**.
4. Choose the destinations offered by Android's wallpaper preview.

This APK uses **`org.coastlive.worlds`**. It installs **alongside** the earlier **Coast Live Layers** app (`org.coastlive.layers`); it does not update or remove that app. The earlier signing key was unavailable, so a new release key was created. Settings do not transfer between the two apps. Keep the old app until you have checked the new one.

Requires Android 7.0+ and live-wallpaper support. Device vendors decide which home/lock-screen destinations are available. The app requests Internet permission for optional Live Weather and no location permission.

## Features shared by all scenes

- **Local sunlight:** the system time zone selects an approximate representative location; enter latitude and longitude for your actual city. The scene you choose does not change your coordinates.
- **Sun and moon layers:** the sun is drawn as a geometrical circle. Its vertical position changes with the scene horizon without stretching the disk. The moon's disk is also unstretched, while its visible shape follows the lunar calendar. Celestial paths remain artistic, not a planetarium simulation. Scenery naturally occludes them.
- **Time controls:** preview any minute, keep a fixed time, or return to the local clock. Foreground motion continues at fixed time. The lunar phase follows the local date.
- **Manual weather:** Clear, Overcast, Foggy, and Stormy work offline. Clouds, wind, illumination, mist, precipitation, and water movement respond together where appropriate to the scene.
- **Live Weather:** uses the solar coordinates, rounded to two decimals, with Open-Meteo. Conditions refresh every 15 minutes while needed; failed requests retry after five minutes. Cached readings expire after 90 minutes from the provider timestamp, then Clear is used. Weather remains current when previewing a different hour.
- **Night lighting:** selected lanterns, windows, and lava retain an independent light layer at night. Water scenes include sun/moon-driven glints; full moonlight strengthens those glints.
- **Frame-rate choices:** GNOME 8/15/25/50 FPS; Android 15/24/30/50 FPS. These are requested rates, not guaranteed performance. Android Battery Saver caps animation at 15 FPS and the wallpaper animation pauses when hidden.
- **GNOME Appearance:** Match GNOME background generates a composed still at most once per minute, with an immediate update when changing scene or fixing a new time. It supports all 24 scenes, including the corrected Sahara sun. Background restoration and manual-wallpaper priority are retained. The Activities/Appearance image is a still.
- **Display support:** proportional desktop monitor layouts, Android portrait/landscape, and phone/tablet screen shapes. Portrait crops the wide illustration; it does not squeeze it into a narrow image.

In Underwater Kelp Cathedral, weather changes the filtered surface light and plant motion; bubbles and currents replace falling rain under the water. In Autumn Bookshop Window, precipitation is restricted to the window area. Names such as “Rainy” and “Moonlit” describe the concept: choose weather and time settings to reproduce that mood.

## Scene list

| Scene | Independent animated details |
| --- | --- |
| Coast | Clouds, water, grass, seabirds, foam, reflections |
| Golden Dunes | Clouds, wind-driven sand |
| Sandstone Plateau | Clouds, dust, grass, sun-directed rock shadows |
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
| Jerash After Rain | Puddle glints, rain splashes, dust, stylized shadows |
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

See `TEST-REPORT.md` in the source packages for exact coverage. Tests include native Cairo/GJS rendering, Android native graphics under Robolectric, scene/weather combinations, circular-sun geometry, settings menus, screen shapes, and GNOME lifecycle simulation. These checks are not physical-phone testing or a live GNOME Shell session. Battery drain, GPU behavior, compositor interactions, and sustained 50 FPS still need checking on your actual devices.

## Build and maintain

The GNOME ZIP is readable source. Extract it, change files, compile schemas with `glib-compile-schemas --strict schemas`, then package the directory contents with `zip -r ../coast-live-layered.shell-extension.zip .`. Keep `metadata.json` at the ZIP root.

The complete source ZIP contains both projects, shared artwork, source tests, and Android `build.sh`. Restore the shared assets using the instructions below, then change into `android/coast-live-android`. Install JDK 17+, Android SDK Platform 35 and Build-Tools 35.0.0, Bash, and ZIP. Build with your retained keystore:

```sh
export ANDROID_HOME=/path/to/android-sdk
bash build.sh /path/to/coast-worlds.p12 coast-live-worlds.apk
```

The separate **private signing backup** contains this release's key and password for future updates. Keep it private and retain it. It is deliberately omitted from the app, GNOME extension, and public source archives. An APK signed with another key cannot update this installation in place.

Generated art prompts are retained in `ART-PROMPTS.json`. The catalog in `data/worlds.json` defines effect placement and light-source samples. GNOME's `world-catalog.js` mirrors that data; Android reads the JSON directly. The original solar, moon-phase, location, weather, and preset modules remain shared in behavior.

## Weather attribution and licensing

Weather data by [Open-Meteo](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its free hosted endpoint is for non-commercial use; review the [current terms](https://open-meteo.com/en/terms) before monetizing or publishing a commercial build. [API documentation](https://open-meteo.com/en/docs).

The project retains GPL-2.0-or-later licensing; see `COPYING`. New terrain illustrations were generated for this project and are included with the same project distribution terms. IANA location data is public domain. The existing moon-phase table was derived using Astronomy Engine 2.1.19, with its existing attribution retained.

### Complete source archive

`coast-live-worlds-source.zip` contains both platform projects and the verification scripts. To avoid downloading the same illustrations twice, Android's identical assets are stored once in the GNOME tree. After extraction, run this from the archive root before building Android:

```sh
python3 tools/prepare-assets.py
```

Then use `android/coast-live-android/build.sh` and the verification instructions in `tests/README.md`.
