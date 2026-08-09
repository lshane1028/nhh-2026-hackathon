"use client";

/**
 * Pixel sprites for the things riding on a card.
 *
 * These are drawn on a 12x12 grid as literal squares, with `shape-rendering:
 * crispEdges` and no curves anywhere, because the card art is pixel art and a
 * smooth vector badge with a letter in it looks pasted on from another game.
 *
 * Each sprite is a small ASCII map:
 *   `.` transparent   `X` body colour   `o` dark outline   `+` highlight
 *
 * Body and highlight are per-mark so one sprite can serve several modifiers in
 * different colours, but no two marks ever share BOTH sprite and colour — see
 * card-visuals.ts, and the test that enforces it.
 */

const SIZE = 12;

export type MarkSprite =
  | "coin"
  | "star"
  | "gem"
  | "ink"
  | "rings"
  | "weight"
  | "drops"
  | "ripple"
  | "knot"
  | "pin"
  | "ribbon"
  | "shard"
  | "moon";

/* 엽전 — round with a square hole. The one shape nobody misreads. */
const COIN = [
  "....oooo....",
  "..ooXXXXoo..",
  ".oXXXXXXXXo.",
  ".oXXoooo XXo",
  "oXXo....oXXo",
  "oXXo....oXXo",
  "oXXo....oXXo",
  ".oXXoooooXXo",
  ".oXXXXXXXXo.",
  "..ooXXXXoo..",
  "....oooo....",
  "............",
];

const STAR = [
  ".....oo.....",
  ".....XX.....",
  "....oXXo....",
  "..ooXXXXoo..",
  "ooXXXXXXXXoo",
  ".oXXXXXXXXo.",
  "..oXXXXXXo..",
  "..oXXooXXo..",
  ".oXXo..oXXo.",
  "ooXo....oXoo",
  ".o........o.",
  "............",
];

/*
  The 낙관 sprite is gone with the rest of the seal artwork — see
  docs/HANDOFF-SEALS.md. Two versions were tried and neither landed, so the
  slate is deliberately clean for whoever builds it.
*/

const GEM = [
  "...oooooo...",
  "..oXX++XXo..",
  ".oXXXXXXXXo.",
  "oXXXXXXXXXXo",
  ".oXXXXXXXXo.",
  "..oXXXXXXo..",
  "...oXXXXo...",
  "....oXXo....",
  ".....oo.....",
  "............",
  "............",
  "............",
];

/* 먹칠 — a spilled blot. */
const INK = [
  "....oooo....",
  "..ooXXXXoo..",
  ".oXXXXXXXXo.",
  "oXXXXXXXXXXo",
  "oXXXXXXXXXXo",
  "oXXXXXXXXXXo",
  ".oXXXXXXXXo.",
  "..oXXXXXXo..",
  "...oXXXXo...",
  "..o.oXXo..o.",
  ".....oo.....",
  "............",
];

/* 짝패 — two links, because the card only pays next to another one. */
const RINGS = [
  "............",
  ".ooo...ooo..",
  "oXXXo.oXXXo.",
  "oX.Xo.oX.Xo.",
  "oX.XoooX.Xo.",
  "oXXXoooXXXo.",
  ".oooo.oooo..",
  "............",
  "............",
  "............",
  "............",
  "............",
];

/* 무거운 달 — a slab. Reads as weight even at 14px. */
const WEIGHT = [
  "............",
  "..oooooooo..",
  ".oXXXXXXXXo.",
  "oXX++++++XXo",
  "oXXXXXXXXXXo",
  "oXXXXXXXXXXo",
  "oXXXXXXXXXXo",
  "oXXXXXXXXXXo",
  ".oXXXXXXXXo.",
  "..oooooooo..",
  "............",
  "............",
];

/* 덧피 — extra pips. */
const DROPS = [
  "............",
  "..oo....oo..",
  ".oXXo..oXXo.",
  ".oXXo..oXXo.",
  "..oo....oo..",
  "............",
  ".....oo.....",
  "....oXXo....",
  "....oXXo....",
  ".....oo.....",
  "............",
  "............",
];

const RIPPLE = [
  "...oooooo...",
  "..o......o..",
  ".o..oooo..o.",
  "o..o....o..o",
  "o.o..oo..o.o",
  "o.o.oXXo.o.o",
  "o.o..oo..o.o",
  "o..o....o..o",
  ".o..oooo..o.",
  "..o......o..",
  "...oooooo...",
  "............",
];

/* 행운패 — a knot. */
const KNOT = [
  "............",
  "..oo....oo..",
  ".oXXo..oXXo.",
  "..oXXooXXo..",
  "...oXXXXo...",
  "...oXXXXo...",
  "..oXXooXXo..",
  ".oXXo..oXXo.",
  "..oo....oo..",
  "............",
  "............",
  "............",
];

/* 고집패 — a nail driven through. */
const PIN = [
  "..oooooooo..",
  ".oXXXXXXXXo.",
  "..oooXXooo..",
  "....oXXo....",
  "....oXXo....",
  "....oXXo....",
  "....oXXo....",
  ".....oXo....",
  ".....oXo....",
  "......o.....",
  "............",
  "............",
];

const RIBBON = [
  "............",
  "..oooooooo..",
  ".oXXXXXXXXo.",
  ".oX++++++Xo.",
  ".oXXXXXXXXo.",
  "..oooooooo..",
  "...o....o...",
  "...oXo.oXo..",
  "...oXo.oXo..",
  "....o...o...",
  "............",
  "............",
];

/* 유리패 — a cracked shard. */
const SHARD = [
  ".....oo.....",
  "....oXXo....",
  "...oXX+Xo...",
  "..oXX++XXo..",
  ".oXX+..+XXo.",
  "oXX+....+XXo",
  ".oXX+..+XXo.",
  "..oXX++XXo..",
  "...oXXXXo...",
  "....oXXo....",
  ".....oo.....",
  "............",
];

/* 광 취급 — a small moon, the sign of a 광 card. */
const MOON = [
  "....oooo....",
  "..ooXXXXoo..",
  ".oXX++++XXo.",
  "oXX++++++XXo",
  "oX++++++++Xo",
  "oX++++++++Xo",
  "oXX++++++XXo",
  ".oXX++++XXo.",
  "..ooXXXXoo..",
  "....oooo....",
  "............",
  "............",
];

const SPRITES: Record<MarkSprite, readonly string[]> = {
  coin: COIN,
  star: STAR,
  gem: GEM,
  ink: INK,
  rings: RINGS,
  weight: WEIGHT,
  drops: DROPS,
  ripple: RIPPLE,
  knot: KNOT,
  pin: PIN,
  ribbon: RIBBON,
  shard: SHARD,
  moon: MOON,
};

const OUTLINE = "#17110c";

export interface CardMarkProps {
  sprite: MarkSprite;
  /** Body colour. */
  fill: string;
  /** Highlight, for the `+` pixels. Defaults to a pale wash of the body. */
  highlight?: string;
  title?: string;
}

export function CardMark({ sprite, fill, highlight = "#fff3d2", title }: CardMarkProps) {
  const rows = SPRITES[sprite] ?? COIN;
  const cells: React.ReactElement[] = [];

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length && x < SIZE; x += 1) {
      const glyph = row[x];
      if (glyph === "." || glyph === " ") continue;
      const colour = glyph === "o" ? OUTLINE : glyph === "+" ? highlight : fill;
      cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour} />);
    }
  });

  return (
    <svg
      className="card-mark"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? ""}
    >
      {title ? <title>{title}</title> : null}
      {cells}
    </svg>
  );
}
