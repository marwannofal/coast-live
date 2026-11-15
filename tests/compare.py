#!/usr/bin/env python3
"""Compare renderer outputs against the GNOME/Cairo reference. Usage: compare.py DIR  (see compare-renderers.sh)"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

# Mean absolute difference allowed, in levels of 255. Java is a port and must be near-identical; the QML
# scene is drawn with gradients and sprites instead of per-pixel images, so it is only close.
# (Java is allowed 0.7: large translucent overlays, i.e. weather, round alpha slightly differently from Cairo.)
LIMIT = {'java': 0.7, 'qml': 3.0}
folder = Path(sys.argv[1])
failed = False
print(f"{'scene':<16}{'renderer':<9}{'mean diff':>10}{'p99':>6}  verdict")
for ref in sorted(folder.glob('ref-*.png')):
    scene = ref.stem[4:]
    a = np.asarray(Image.open(ref).convert('RGB')).astype(int)
    for kind in ('qml', 'java'):
        other = folder / f'{kind}-{scene}.png'
        if not other.exists():
            continue
        b = np.asarray(Image.open(other).convert('RGB')).astype(int)
        diff = np.abs(a - b)
        mean, p99 = diff.mean(), np.percentile(diff.max(axis=2), 99)
        ok = mean <= LIMIT[kind]
        failed |= not ok
        print(f'{scene:<16}{kind:<9}{mean:>10.2f}{p99:>6.0f}  {"ok" if ok else "FAIL"}')
sys.exit(1 if failed else 0)
