"""Prepare the Amman scene from the concept art (art-source/amman.png).

The picture has a flat blue sky, which is cut away (every pixel of the sky colour, also enclosed gaps) so the generated sky shows through,
and a flag on its pole, which is erased: the flag is drawn and waved by the core (core/flag.js).
Terrain layers are tinted for the lighting anchors exactly like the Sahara scenes (tools/build-sahara.py).
"""
from pathlib import Path
import importlib.util
import json
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sahara', ROOT / 'tools' / 'build-sahara.py')
sahara = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sahara)

SIZE = sahara.SIZE
SKY_TOLERANCE = 30        # summed RGB distance from the sky colour (the sky has a faint gradient, +-5)
FLAG_BOX = (1100, 336, 1180, 425)   # x0, y0, x1, y1 in source pixels: the baked-in flag, pole excluded

def sky_mask(rgb):
    reference = np.median(rgb[:200].reshape(-1, 3), axis=0)
    close = np.abs(rgb.astype(int) - reference).sum(2) <= SKY_TOLERANCE
    # Every sky-coloured pixel counts, also the enclosed gaps (between the columns of the Temple of Hercules).
    return close

def main(source):
    folder = ROOT / 'assets' / 'themes' / 'amman'
    folder.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(source).convert('RGB')).copy()
    sky = sky_mask(rgb)
    x0, y0, x1, y1 = FLAG_BOX
    sky[y0:y1, x0:x1] = True
    # Colour under the removed sky comes from the nearest terrain pixel, so no blue fringe survives scaling.
    nearest = distance_transform_edt(sky, return_distances=False, return_indices=True)
    filled = rgb[nearest[0], nearest[1]]
    filled[~sky] = rgb[~sky]
    small = np.asarray(Image.fromarray(filled).resize(SIZE, Image.Resampling.LANCZOS)).astype(float)
    alpha = np.asarray(Image.fromarray(((~sky) * 255).astype(np.uint8)).resize(SIZE, Image.Resampling.BOX)) > 140
    sahara.SKY_SCALES['amman'] = SKY_SCALE
    for slot, (frame, tint) in enumerate(zip(sahara.ANCHORS, sahara.TINTS)):
        image = sahara.rgba(small, alpha, tint)
        image.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
            folder / f'ground-{slot:02}.png', optimize=True)
    for slot in range(0, 33, 2):
        frame = round(slot * 1999 / 32)
        still = Image.new('RGB', SIZE)
        still.paste(sahara.sky(frame, 'amman'), (0, 0))
        terrain = sahara.rgba(small, alpha, sahara.palette(frame))
        still.paste(terrain, mask=terrain.getchannel('A'))
        still.save(folder / f'still-{slot:02}.jpg', quality=88, optimize=True)
    layout_path = ROOT / 'assets' / 'themes' / 'layout.json'
    layout = json.loads(layout_path.read_text())
    layout['skyScales']['amman'] = SKY_SCALE
    layout_path.write_text(json.dumps(layout))

SKY_SCALE = 0.72

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'art-source' / 'amman.png')
