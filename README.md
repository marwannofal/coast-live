# Coast Live 3.0

Coast Live is an animated pixel-art wallpaper for GNOME Shell and Android. On GNOME, the sun, moon and sky lighting use a library of 2,000 Full HD images. Clouds, waves and grass animate independently and take their colors from the current sky.

## Install on GNOME

This release targets GNOME Shell 45–50. Download `coast-live.shell-extension.zip` from the release and save it in Downloads. Run the following as your desktop user.

```sh
gnome-shell --version
gnome-extensions install ~/Downloads/coast-live.shell-extension.zip
```

Log out of GNOME and sign back in, then enable the extension.

```sh
gnome-extensions enable coast-live@coastlive
gnome-extensions info coast-live@coastlive
```

The extension is running when its state is `ACTIVE`. It starts at subsequent sign-ins. Open a clear view of the desktop to see the motion.

## Install on Android

The Coast Live 1.0 APK targets Android 7.0 and newer on phones and tablets that support live wallpapers. It runs offline, uses the device’s time zone to select a solar scene, and plays 30 FPS animation in portrait or landscape.

1. Download `coast-live.apk` from the release to your phone or tablet.
2. Open the APK from Downloads and tap **Install**.
3. Open **Coast Live** from your apps, then tap **Set wallpaper** in Android’s wallpaper preview.
4. Choose from the screens offered by your device.

## GNOME location and animation

The extension reads the system time zone and uses the representative location from the IANA time-zone database. For example, `Asia/Shanghai` uses Shanghai, even if you are elsewhere in China. For accurate timing in another city within the zone, enter its latitude and longitude. Change the computer’s time zone in GNOME **Settings → Date & Time** when you travel.

```sh
gnome-extensions prefs coast-live@coastlive
```

Under **Solar location**, switch on **Use custom coordinates**. Beijing, for example, is approximately `39.90` latitude and `116.41` longitude. Use negative numbers for south or west. The settings show which location is currently in use. When a zone has no representative city, the extension estimates longitude from the clock offset. The animation and solar calculations run offline.

Under **Appearance**, **Match GNOME background** uses a Coast Live still for the GNOME Appearance preview and Activities overview. The still refreshes at most once per minute. Coast Live restores the previous wallpaper on disable when its own image is still selected. A wallpaper selected manually takes priority.

Under **Animation**, choose Economy (8 FPS), Balanced (15 FPS), Smooth (25 FPS), or Ultra (50 FPS). Balanced is the default. The frame rate changes how often the moving layers are redrawn. The sky still follows local sunlight. The sun and moon paths are artistic, and polar day and night use special lighting sequences.

## Disable, uninstall, or troubleshoot on GNOME

```sh
gnome-extensions disable coast-live@coastlive
gnome-extensions uninstall coast-live@coastlive
```

If the install command succeeds but the extension is missing from the list, sign out of GNOME and sign back in. If GNOME reports an error loading the extension, get its state and look for the error in the current boot’s journal.

```sh
gnome-extensions info coast-live@coastlive
journalctl --user -b _COMM=gnome-shell -g 'Coast Live|amman-coast-live' --no-pager
```

## Maintain and build the GNOME extension

The install ZIP contains the readable source, preferences, schema, time-zone data, and wallpaper assets. Extract it into a project directory to work on the source.

| File | Purpose |
| --- | --- |
| `extension.js` | Mounts the desktop actors and controls the animation and lighting clocks |
| `background-sync.js` | Updates and restores the native GNOME background |
| `scene.js` | Draws and colors the animated layers |
| `solar-clock.js` | Estimates solar altitude, sunrise, sunset, and twilight |
| `location.js`, `zone-data.js` | Selects the representative location or custom coordinates |
| `prefs.js`, `schemas/` | GNOME preferences and persistent settings |
| `solar/`, `scene-data.json` | Full HD sky images and synchronized lighting data |

From the project directory, compile the schema and package the extension. This requires `glib-compile-schemas` and `zip`.

```sh
glib-compile-schemas --strict schemas
zip -r ../coast-live.shell-extension.zip \
    metadata.json extension.js prefs.js scene.js solar-clock.js location.js zone-data.js background-sync.js \
    schemas data solar scene-data.json tools README.md COPYING preview.jpg
```

Use the packaged ZIP for local installation tests. Check that automatic location, custom coordinates, all frame rates, Appearance and Activities, monitor changes, disable and re-enable, and desktop sign-in work on the GNOME releases you list as supported.

### Regenerate the artwork

The release includes the rendered artwork. To regenerate it from source, install Node.js and FFmpeg, then run these commands from the project directory.

```sh
mkdir -p solar
node tools/render-art.cjs scene-data.json | ffmpeg -y -f rawvideo \
    -pix_fmt rgb24 -video_size 960x540 -framerate 30 -i pipe:0 \
    -vf scale=1920:1080:flags=neighbor -c:v mjpeg -pix_fmt yuvj444p \
    -q:v 5 -start_number 0 solar/frame_%04d.jpg
```

### Publish a release

For a GitHub release, put the project files and this README in a repository, create a release tagged `v3.0.0`, and attach `coast-live.shell-extension.zip` for GNOME and `coast-live.apk` for Android. Point users to the installation steps above. Check Android installation and wallpaper playback on a device before publishing the APK. You can also attach `preview.jpg` as a screenshot.

Suggested release description

> Coast Live brings an animated pixel-art coastline to GNOME and Android. The sky follows local daylight, while clouds, surf, and grass move continuously. GNOME offers custom coordinates and four frame rates. Android includes 30 FPS portrait and landscape animation.

For the official GNOME Extensions directory, review and test the extension against its submission guidelines. Add your public source or support URL to `metadata.json` and list the GNOME versions you have tested. The directory expects maintainers to understand and maintain the code and applies its own review policy to AI-generated code. For that submission, package the runtime files, schema XML, artwork and license. Keep the Node.js artwork generator in the public source repository.

- GitHub release instructions — https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
- GNOME Shell Extensions review guidelines — https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- GNOME Shell Extensions submission — https://extensions.gnome.org/upload/

## Licensing and credits

The extension JavaScript is provided under GPL-2.0-or-later. See `COPYING`. The bundled time-zone locations and aliases come from the public-domain IANA time-zone database. The solar approximation uses NOAA’s published solar equations.

The wallpaper frames and cloud masks in this release are generated from original procedural artwork in `tools/render-art.cjs`. They are distributed under GPL-2.0-or-later with the extension. This release uses its own artwork for public distribution.

- Time-zone data — https://www.iana.org/time-zones
- Solar equations — https://gml.noaa.gov/grad/solcalc/solareqns.PDF
