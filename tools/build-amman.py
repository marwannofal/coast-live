"""Prepare the Amman scene from the concept art (art-source/amman.png).

The picture has a flat blue sky, which is cut away (every pixel of the sky colour, also enclosed gaps) so the generated sky shows through,
and a flag on its pole, which is erased: the flag is drawn and waved by the core (core/flag.js).
Terrain layers are tinted for the lighting anchors exactly like the Sahara scenes (tools/build-sahara.py), and
blended with the night picture (art-source/amman-night.png, the same view with the lights on) so the windows and
the floodlit landmarks switch on at dusk and off at sunrise.
"""
from pathlib import Path
import importlib.util
import json
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sahara', ROOT / 'tools' / 'build-sahara.py')
sahara = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sahara)

SIZE = (1920, 1080)   # terrain is stored at full-HD (the scene's 960x540 grid is scaled 2x), to keep the art's crisp outlines
SKY_TOLERANCE = 30        # summed RGB distance from the sky colour (the sky has a faint gradient, +-5)
# How much of the night picture each lighting anchor shows (anchors: midnight, ..., noon, ..., sunset, dusk, night).
NIGHT_WEIGHT = [1, 1, 0.85, 0.15, 0, 0, 0, 0.05, 0.6, 1, 1]
LIT_SPEEDUP = 1.8         # lit windows come on (and go off) faster than the rest of the picture darkens
FLAG_BOX = (1100, 336, 1180, 425)   # x0, y0, x1, y1 in source pixels: the baked-in flag, pole excluded

def sky_mask(rgb):
    reference = np.median(rgb[:200].reshape(-1, 3), axis=0)
    close = np.abs(rgb.astype(int) - reference).sum(2) <= SKY_TOLERANCE
    # Every sky-coloured pixel counts, also the enclosed gaps (between the columns of the Temple of Hercules).
    return close

def load(path, size):
    return np.asarray(Image.open(path).convert('RGB').resize(size, Image.Resampling.LANCZOS)).copy()

def main(source, night_source):
    folder = ROOT / 'assets' / 'themes' / 'amman'
    folder.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(source).convert('RGB')).copy()
    sky = sky_mask(rgb)
    x0, y0, x1, y1 = FLAG_BOX
    sky[y0:y1, x0:x1] = True
    # Outline pixels that blend the sky into a dark edge stay faintly blue; drop the blue ones touching the sky.
    r, g, bl = (rgb[..., i].astype(int) for i in range(3))
    sky |= binary_dilation(sky, iterations=1) & (bl > r + 40) & (bl > g + 15)
    # Colour under the removed sky comes from the nearest terrain pixel, so no blue fringe survives scaling.
    nearest = distance_transform_edt(sky, return_distances=False, return_indices=True)
    filled = rgb[nearest[0], nearest[1]]
    filled[~sky] = rgb[~sky]
    small = np.asarray(Image.fromarray(filled).resize(SIZE, Image.Resampling.LANCZOS)).astype(float)
    # The night picture is the same view (within a pixel), so the day picture's sky mask is reused; the colour under
    # the sky is filled from the nearest terrain pixel as above.
    night = load(night_source, (rgb.shape[1], rgb.shape[0]))
    night = night[nearest[0], nearest[1]]
    night[~sky] = load(night_source, (rgb.shape[1], rgb.shape[0]))[~sky]
    night_small = np.asarray(Image.fromarray(night).resize(SIZE, Image.Resampling.LANCZOS)).astype(float)
    luma = lambda a: a @ np.array([0.299, 0.587, 0.114])

    def lit_terrain(tint, weight):
        day = small * tint
        if weight <= 0:
            return day
        lit = luma(night_small) > 1.3 * luma(day) + 20
        w = np.where(lit, min(1, weight * LIT_SPEEDUP), weight)[..., None]
        return day * (1 - w) + night_small * w
    alpha = np.asarray(Image.fromarray(((~sky) * 255).astype(np.uint8)).resize(SIZE, Image.Resampling.BILINEAR)) > 128
    sahara.SKY_SCALES['amman'] = SKY_SCALE
    for slot, (frame, tint) in enumerate(zip(sahara.ANCHORS, sahara.TINTS)):
        image = sahara.rgba(lit_terrain(tint, NIGHT_WEIGHT[slot]), alpha, 1)
        image.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
            folder / f'ground-{slot:02}.png', optimize=True)
    for slot in range(0, 33, 2):
        frame = round(slot * 1999 / 32)
        still = sahara.sky(frame, 'amman').resize(SIZE, Image.Resampling.BILINEAR)
        slot_position = np.interp(frame, sahara.ANCHORS, range(len(sahara.ANCHORS)))
        weight = float(np.interp(slot_position, range(len(NIGHT_WEIGHT)), NIGHT_WEIGHT))
        terrain = sahara.rgba(lit_terrain(sahara.palette(frame), weight), alpha, 1)
        still.paste(terrain, mask=terrain.getchannel('A'))
        still.save(folder / f'still-{slot:02}.jpg', quality=88, optimize=True)
    layout_path = ROOT / 'assets' / 'themes' / 'layout.json'
    layout = json.loads(layout_path.read_text())
    layout['skyScales']['amman'] = SKY_SCALE
    layout_path.write_text(json.dumps(layout))

SKY_SCALE = 0.72

if __name__ == '__main__':
    main(ROOT / 'art-source' / 'amman.png', ROOT / 'art-source' / 'amman-night.png')
