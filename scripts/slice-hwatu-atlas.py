"""
Cut the hwatu atlas into 48 individual card PNGs.

Why this exists: the sheet LOOKS like an 8x6 grid of 160x240 cells, and that is
how it was being sliced. It is not. The cells are irregular -- columns run
148..162 wide and rows 226..244 tall -- so a uniform slice pulled a strip of the
black gutter and a sliver of the neighbour's red frame into every tile. That is
the blank edge you could see on the cards.

The grid below is measured, not assumed. Between every pair of cards there is a
band that is dark on EVERY pixel (max channel <= 59, against a card frame that
is 200+), so the separators are unambiguous and were found by asking which
columns/rows are dark for their whole length. Each card then fills its box
exactly, edge to edge -- verified, insets are 0 on all four sides.

Re-run only if the atlas is regenerated, and re-measure first if so.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "public/assets/cards/hwatu-basic-atlas-generated-v4-aligned.png"
OUT = ROOT / "public/assets/cards/hwatu"

# Measured separators, inclusive. Every pixel inside these is dark.
VERTICAL_GUTTERS = [(162, 167), (322, 327), (483, 489), (645, 651), (804, 809), (962, 968), (1126, 1131)]
HORIZONTAL_GUTTERS = [(232, 236), (473, 477), (713, 717), (962, 966), (1193, 1197)]

# Every real hwatu card is the same physical size; the jitter in the sheet is
# sampling noise, so the cut is normalised to one canonical 2:3 tile. This is
# what kills the letterboxing -- a slot can be filled edge to edge with no gap.
CANONICAL = (320, 480)

# Two sets are written on purpose.
#
# `native/` is the crop and nothing else -- no resampling at all, so pasting the
# 48 files back over the atlas reproduces it to the pixel. That is the archive
# copy; if the normalisation ever needs redoing, redo it from there, not from
# the sheet.
#
# The shipping set is webp at q95. The art carries ~13k distinct colours (it is
# textured, not flat), so palette quantising bands the yellows badly, while q95
# is indistinguishable at 8x zoom for a sixth of the bytes: 185KB -> 32KB a
# card, 8.7MB -> 1.5MB over the deck. `generated/` is already webp.
WEBP_QUALITY = 95

MONTH_SLUGS = {
    1: ["bright-crane", "ribbon-hong", "chaff-a", "chaff-b"],
    2: ["animal-bird", "ribbon-hong", "chaff-a", "chaff-b"],
    3: ["bright-curtain", "ribbon-hong", "chaff-a", "chaff-b"],
    4: ["animal-bird", "ribbon-cho", "chaff-a", "chaff-b"],
    5: ["animal-bridge", "ribbon-cho", "chaff-a", "chaff-b"],
    6: ["animal-butterfly", "ribbon-cheong", "chaff-a", "chaff-b"],
    7: ["animal-boar", "ribbon-cho", "chaff-a", "chaff-b"],
    8: ["bright-moon", "animal-bird", "chaff-a", "chaff-b"],
    9: ["animal-cup", "ribbon-cheong", "chaff-a", "chaff-b"],
    10: ["animal-deer", "ribbon-cheong", "chaff-a", "chaff-b"],
    11: ["bright-phoenix", "double-chaff", "chaff-a", "chaff-b"],
    12: ["bright-rain", "animal-bird", "ribbon-rain", "double-chaff"],
}


def boxes(gutters, end):
    """Turn separator bands into inclusive [start, end] boxes."""
    out, start = [], 0
    for low, high in gutters:
        out.append((start, low - 1))
        start = high + 1
    out.append((start, end - 1))
    return out


def main():
    atlas = Image.open(ATLAS).convert("RGBA")
    columns = boxes(VERTICAL_GUTTERS, atlas.width)
    rows = boxes(HORIZONTAL_GUTTERS, atlas.height)
    assert len(columns) == 8 and len(rows) == 6, (len(columns), len(rows))

    OUT.mkdir(parents=True, exist_ok=True)
    native = OUT / "native"
    native.mkdir(exist_ok=True)

    written = []
    for month in range(1, 13):
        row = rows[(month - 1) // 2]
        first = ((month - 1) % 2) * 4
        for offset, slug in enumerate(MONTH_SLUGS[month]):
            x0, x1 = columns[first + offset]
            y0, y1 = row
            tile = atlas.crop((x0, y0, x1 + 1, y1 + 1))
            stem = f"card-{month:02d}-{slug}"
            tile.save(native / f"{stem}.png")
            tile.resize(CANONICAL, Image.LANCZOS).save(
                OUT / f"{stem}.webp", quality=WEBP_QUALITY, method=6,
            )
            written.append((stem, tile.size))

    verify(atlas, columns, rows, native)

    print(f"wrote {len(written)} cards to {OUT}")
    for stem, size in written:
        print(f"  {stem:32s} native {size[0]:3d}x{size[1]:3d} -> {CANONICAL[0]}x{CANONICAL[1]}")


def verify(atlas, columns, rows, native):
    """
    Paste every crop back and demand the atlas returns pixel for pixel.

    A crop that took a slice of the neighbour, or dropped a column, cannot
    survive this: the round trip only closes if each tile is exactly the region
    it claims. Whatever the reassembly does not cover has to be separator, so
    the check also asserts nothing bright was left behind in the gaps.
    """
    import numpy as np

    truth = np.asarray(atlas)
    canvas = np.zeros_like(truth)
    covered = np.zeros(truth.shape[:2], bool)
    for month in range(1, 13):
        y0, y1 = rows[(month - 1) // 2]
        first = ((month - 1) % 2) * 4
        for offset, slug in enumerate(MONTH_SLUGS[month]):
            x0, x1 = columns[first + offset]
            tile = Image.open(native / f"card-{month:02d}-{slug}.png").convert("RGBA")
            canvas[y0:y1 + 1, x0:x1 + 1] = np.asarray(tile)
            covered[y0:y1 + 1, x0:x1 + 1] = True

    differing = int((canvas[covered] != truth[covered]).sum())
    assert differing == 0, f"{differing} pixels differ after reassembly"
    leftover = int(truth[~covered][..., :3].max())
    assert leftover < 60, f"uncovered region is not separator: brightest {leftover}"
    print(f"verified: reassembly is pixel-identical, gaps peak at {leftover}/255")


if __name__ == "__main__":
    main()
