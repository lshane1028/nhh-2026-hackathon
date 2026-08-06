# Hwatu base atlas — generated v3

- Date: 2026-08-06
- Tool: OpenAI image generation
- Mode: style-transfer edit
- Generated output: `public/assets/cards/hwatu-basic-atlas-generated-v3.png`
- Game-ready aligned output: `public/assets/cards/hwatu-basic-atlas-generated-v4-aligned.png`
- Structure reference: `public/assets/cards/hwatu-basic-atlas.png`
- Style reference: earlier Korean pixel-art January month sheet generated in this project

## Prompt

Redraw the complete traditional Korean hwatu atlas as genuine handcrafted pixel art. Treat the original atlas as authoritative for content and geometry: keep exactly 48 cards in the exact 8-column by 6-row order, with the same card boundaries, portrait proportions, traditional motifs, silhouettes, object counts, relative sizes, positions, orientations, negative space, ribbon presence and colors, animals, flowers, branches, moon, rain, and ground shapes. Preserve the red and blue ribbon markings as recognizable brush-calligraphy-like pixel marks. A veteran Korean hwatu player must identify every card and month immediately.

Use the earlier January sheet only as a rendering-style reference: strong square pixel clusters, stepped diagonals, crisp hard edges, no antialiasing, restrained Korean minhwa line character, subtle hanji fiber, and a dancheong palette of ink black, warm ivory, vivid red, indigo, pine green, and aged gold. Do not add scenery or decorations absent from the corresponding original card, and do not reorder, crop, merge, omit, duplicate, or redesign cards. Output a single flat 8x6 sprite atlas without perspective, labels, mockup, or shadows.

## Deterministic alignment correction

The image model returned irregular cell widths/heights and an unused black margin. Each of the 48 generated card regions was therefore extracted at its detected border and resized with nearest-neighbor sampling into an exact 160x240 cell. The final atlas is exactly 1280x1440, with no unused margin and no CSS filtering.
