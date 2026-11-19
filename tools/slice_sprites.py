#!/usr/bin/env python3
"""Cut the 4x4 AI sprite sheets in art/sheets into single cleaned sprites in art/cut.

Usage: python3 -I tools/slice_sprites.py [sheet letters, e.g. AS AT; all when none]
Needs Pillow and numpy. Output is committed, so the game build does not need Python.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'art', 'sheets')
OUT = os.path.join(ROOT, 'art', 'cut')

ALPHA_CUT = 128   # below this a pixel is background
ERODE = 3         # px eaten from the outline: removes the coloured halo the generator leaves
MIN_PART = 0.04
# sheets that are not 4x4: letter -> (rows, columns); their cells are named <letter><row><column, two digits>
GRIDS = {'AQ': (5, 10), 'AR': (5, 10), 'DJ': (10, 10)}
# tightly packed sheets whose figures reach into the next cell
STRAYS = {'DJ'}
# sheets with clear glass helmets: the magenta seen through the glass becomes a faint light bubble, not a hole
GLASS = {'CY', 'CZ', 'DB', 'DC'}   # parts smaller than this share of the biggest part are specks and are dropped


def find_cuts(mask: np.ndarray, axis: int, n: int = 4, search: int = 60) -> list[int]:
    """Cut lines between rows/columns: the emptiest line near each nominal boundary."""
    size = mask.shape[axis]
    cover = mask.sum(axis=1 - axis)
    cuts = [0]
    for k in range(1, n):
        nominal = round(size * k / n)
        lo, hi = max(1, nominal - search), min(size - 1, nominal + search)
        window = cover[lo:hi]
        best = np.flatnonzero(window == window.min())
        # among the emptiest lines take the one closest to the nominal cut
        cuts.append(int(lo + best[np.argmin(np.abs(best + lo - nominal))]))
    cuts.append(size)
    return cuts


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    m = mask.copy()
    for _ in range(r):
        n = m.copy()
        n[1:, :] &= m[:-1, :]
        n[:-1, :] &= m[1:, :]
        n[:, 1:] &= m[:, :-1]
        n[:, :-1] &= m[:, 1:]
        m = n
    return m


def components(mask: np.ndarray) -> tuple[np.ndarray, list[int]]:
    h, w = mask.shape
    lab = np.zeros((h, w), dtype=np.int32)
    sizes = [0]
    cur = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        cur += 1
        lab[y0, x0] = cur
        q = deque([(y0, x0)])
        count = 0
        while q:
            y, x = q.popleft()
            count += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = cur
                        q.append((yy, xx))
        sizes.append(count)
    return lab, sizes


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    return ~erode(~mask, r)


def gap_cuts(mask: np.ndarray, axis: int, n: int) -> list[int]:
    """The rows of a packed sheet are not even: cut at the nearly empty lines closest to the nominal ones."""
    f = np.convolve(mask.sum(axis=1 - axis), np.ones(7) / 7, 'same')
    size = len(f)
    lows = [y for y in range(10, size - 10) if f[y] == f[y - 10:y + 11].min() and f[y] < 200]
    cuts = [0]
    for k in range(1, n):
        nominal = size * k / n
        near = [y for y in lows if abs(y - nominal) < size / n * 0.6]
        cuts.append(min(near, key=lambda y: abs(y - nominal)) if near else round(nominal))
    return cuts + [size]


def blob_owners(mask: np.ndarray, nr: int, nc: int):
    """Tightly packed sheets: every blob belongs to the cell its middle lies in (needs SciPy)."""
    from scipy import ndimage
    labels, n = ndimage.label(mask, structure=np.ones((3, 3)))
    rows, cols = gap_cuts(mask, 0, nr), gap_cuts(mask, 1, nc)
    print('cells', rows, cols)
    owner = np.zeros(n + 1, dtype=int) - 1
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        ys, xs = np.nonzero(labels[sl] == i)
        cy, cx = sl[0].start + ys.mean(), sl[1].start + xs.mean()
        r = min(nr - 1, int(np.searchsorted(rows, cy, 'right')) - 1)
        c = min(nc - 1, int(np.searchsorted(cols, cx, 'right')) - 1)
        owner[i] = r * nc + c
    return labels, owner


def own_blobs(img: np.ndarray, labels: np.ndarray, owner: np.ndarray, cell: int) -> np.ndarray:
    """The part of the sheet with only the blobs of one cell, cut to their box."""
    mine = dilate(np.isin(labels, np.flatnonzero(owner == cell)), 3) & (img[..., 3] >= ALPHA_CUT)
    ys, xs = np.nonzero(mine)
    if not len(ys):
        return img[:1, :1] * 0
    y0, y1, x0, x1 = max(0, ys.min() - 2), ys.max() + 3, max(0, xs.min() - 2), xs.max() + 3
    out = img[y0:y1, x0:x1].copy()
    out[..., 3] = np.where(mine[y0:y1, x0:x1], out[..., 3], 0)
    return out


def clean_cell(rgba: np.ndarray, symbol: bool = False, glass: bool = False) -> np.ndarray | None:
    mask = rgba[..., 3] >= ALPHA_CUT
    if symbol:
        # thin stamped symbols: no eroding (it eats spears, legs and stars); close the speckles inside instead
        mask = erode(dilate(mask, 2), 2) & (rgba[..., 3] > 0) | mask
        mask = erode(dilate(mask, 2), 2)
    else:
        mask = erode(mask, ERODE)
    if not mask.any():
        return None
    lab, sizes = components(mask)
    biggest = max(sizes[1:])
    keep = np.zeros_like(mask)
    for i, s in enumerate(sizes):
        if i and s >= biggest * (0.004 if symbol else MIN_PART):
            keep |= lab == i
    ys, xs = np.nonzero(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = rgba[y0:y1, x0:x1].copy()
    out[..., 3] = np.where(keep[y0:y1, x0:x1], out[..., 3] if glass else 255, 0)
    out[out[..., 3] == 0, :3] = 0
    return out


def key_magenta(img: np.ndarray, glass: bool = False, strict: bool = False) -> np.ndarray:
    """Sheets made on a solid #FF00FF background (no real transparency): magenta -> transparent.
    strict: only bright magenta goes, for sheets with purple in the sprites (the Cheshire Cat)."""
    rgb = img[..., :3].astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r - g > 90) & (b - g > 90) & (np.abs(r - b) < 90)
    if strict:
        magenta &= (r > 200) & (b > 200)
    out = img.copy()
    out[..., 3] = np.where(magenta, 0, 255)
    # pull the pink spill out of the edges
    spill = np.minimum(r, b) - g
    edge = ~magenta & (spill > 30)
    out[edge, 0] = np.clip(r[edge] - spill[edge] // 2, 0, 255)
    out[edge, 2] = np.clip(b[edge] - spill[edge] // 2, 0, 255)
    if glass:
        # the flat background has green 0..5; magenta with more green is magenta seen through glass
        see = magenta & (g > 12)
        k = np.clip((g - 3) / 242, 0, 1)
        out[see, 0] = (215 + 40 * k[see]).astype(np.uint8)
        out[see, 1] = (232 + 23 * k[see]).astype(np.uint8)
        out[see, 2] = 255
        out[see, 3] = (130 + 120 * k[see]).astype(np.uint8)
    return out


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for name in sorted(os.listdir(SHEETS)):
        if not name.endswith('.png'):
            continue
        letter = name.split('-')[0]  # 'A-grass.png' -> A, 'AB-stumps.png' -> AB
        if len(sys.argv) > 1 and letter not in sys.argv[1:]:
            continue  # only the sheets named on the command line
        img = np.array(Image.open(os.path.join(SHEETS, name)).convert('RGBA'))
        if img[..., 3].min() == 255:
            img = key_magenta(img, letter in GLASS, letter in STRAYS)
        mask = img[..., 3] >= ALPHA_CUT
        nr, nc = GRIDS.get(letter, (4, 4))
        rows = find_cuts(mask, 0, nr, search=40 if nr > 4 else 60)
        cols = find_cuts(mask, 1, nc, search=40 if nc > 4 else 60)
        if letter in STRAYS:
            # who owns what: from the usual key, which keeps the figures apart; the pixels: from the strict one
            loose = key_magenta(np.array(Image.open(os.path.join(SHEETS, name)).convert('RGBA')))[..., 3] >= ALPHA_CUT
            labels, owner = blob_owners(loose, nr, nc)
        for r in range(nr):
            for c in range(nc):
                cid = f'{letter}{r + 1}{c + 1:02}' if letter in GRIDS else f'{letter}{r + 1}{c + 1}'
                cell = img[rows[r]:rows[r + 1], cols[c]:cols[c + 1]]
                if letter in STRAYS:
                    cell = own_blobs(img, labels, owner, r * nc + c)
                sprite = clean_cell(cell, symbol=letter in GRIDS and letter not in STRAYS, glass=letter in GLASS)
                if sprite is None:
                    print(f'{cid}: empty', file=sys.stderr)
                    continue
                Image.fromarray(sprite).save(os.path.join(OUT, f'{cid}.png'))
        print(name, 'rows', rows, 'cols', cols)
    return 0


if __name__ == '__main__':
    sys.exit(main())
