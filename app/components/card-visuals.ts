import type { CardInstance } from "@/game/types";
import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import type { MarkSprite } from "./CardMark";

/**
 * How a card shows what is riding on it.
 *
 * A card can carry four things at once — an 각인, a 판본, a 낙관 and an effect
 * tag — and packs deliberately roll doubles. So marks are separated on three
 * axes at once: each category owns a CORNER, each mark has its own SHAPE, and
 * each has its own COLOUR. Any one axis alone fails somewhere; together they
 * hold up with four marks on one card.
 *
 * The single shared channel is the SURFACE, and only one modifier may own it.
 * That is the Balatro lesson: there is exactly one holo look, and everything
 * else is a thing sitting on top of the card.
 *
 * Deliberately NOT a rainbow. A hwatu card is already red, black, gold and
 * cream; a rainbow sweep on top turns it into noise.
 */

export type CardSurface = "holo" | "glass" | "glitch" | null;

/** Fixed anchors, one per category, so two marks can never collide. */
export type MarkSlot = "top-right" | "bottom-left" | "bottom-right" | "mid-left";

export interface CardMarkSpec {
  id: string;
  slot: MarkSlot;
  sprite: MarkSprite;
  fill: string;
  highlight?: string;
  label: string;
  /** Full sentence for the hover panel. */
  detail: string;
}

/* Hwatu palette. Nothing outside these. */
const RED = "#c2352a";
const GOLD = "#e0ad45";
const INK = "#2c2622";
const JADE = "#2f7a63";
const INDIGO = "#3a5f8a";
const PLUM = "#7a3f74";
const BONE = "#e8dcc2";

interface MarkArt { sprite: MarkSprite; fill: string; highlight?: string }

const ENHANCEMENT_ART: Record<NonNullable<CardInstance["enhancement"]>, MarkArt & { label: string }> = {
  // 엽전 gets the real coin — round with a square hole.
  coin: { sprite: "coin", fill: GOLD, label: "엽전" },
  fortune: { sprite: "star", fill: GOLD, label: "복" },
  inked: { sprite: "ink", fill: INK, label: "먹칠" },
  scarlet: { sprite: "ink", fill: RED, label: "주홍" },
  wild: { sprite: "star", fill: JADE, label: "야생" },
  glass: { sprite: "shard", fill: INDIGO, label: "유리" },
  steel: { sprite: "weight", fill: "#6a6f74", label: "강철" },
  stone: { sprite: "weight", fill: "#7d7264", label: "돌" },
};

const EDITION_ART: Record<NonNullable<CardInstance["edition"]>, MarkArt & { label: string }> = {
  gold_leaf: { sprite: "gem", fill: GOLD, label: "금박" },
  mother_of_pearl: { sprite: "gem", fill: "#9fc8cf", label: "자개" },
  five_color: { sprite: "gem", fill: JADE, label: "오방색" },
  engraved: { sprite: "gem", fill: INK, highlight: BONE, label: "각인" },
};

const SEAL_ART: Record<NonNullable<CardInstance["seal"]>, MarkArt & { label: string }> = {
  yellow: { sprite: "stamp", fill: GOLD, label: "황인" },
  red: { sprite: "stamp", fill: RED, label: "적인" },
  blue: { sprite: "stamp", fill: INDIGO, label: "청인" },
  purple: { sprite: "stamp", fill: PLUM, label: "자인" },
};

/** No two effect tags share both sprite and colour. The test enforces it. */
const EFFECT_ART: Record<string, MarkArt> = {
  keeper_coin: { sprite: "coin", fill: "#b8863a" },
  gilded: { sprite: "star", fill: RED },
  partner_boost: { sprite: "rings", fill: RED },
  heavy_month: { sprite: "weight", fill: INK, highlight: BONE },
  echo: { sprite: "ripple", fill: JADE },
  drawn_luck: { sprite: "knot", fill: JADE },
  as_bright: { sprite: "moon", fill: GOLD },
  as_animal: { sprite: "knot", fill: "#8a5a2b" },
  as_ribbon: { sprite: "ribbon", fill: RED },
  extra_pi: { sprite: "drops", fill: INDIGO },
  twin_kind: { sprite: "rings", fill: PLUM },
  stubborn: { sprite: "pin", fill: "#6a6f74" },
};

/**
 * Which modifier owns the surface, hardest to override first.
 *
 * 복패 wins outright because its whole character is that it is unstable — the
 * glitch has to be visible even when the card is also gilded. 유리패 next, since
 * "this card is made of glass" is a fact about the card itself. Editions come
 * last: they are decoration, and decoration yields.
 */
export function getCardSurface(card: CardInstance): CardSurface {
  if (card.enhancement === "fortune") return "glitch";
  if (card.enhancement === "glass") return "glass";
  if (card.edition) return "holo";
  return null;
}

/** Everything stuck to the card, in a stable order. */
export function getCardMarks(card: CardInstance): CardMarkSpec[] {
  const marks: CardMarkSpec[] = [];

  if (card.enhancement) {
    const art = ENHANCEMENT_ART[card.enhancement];
    marks.push({
      id: `enhancement-${card.enhancement}`,
      slot: "bottom-left",
      sprite: art.sprite,
      fill: art.fill,
      highlight: art.highlight,
      label: art.label,
      detail: `각인 · ${art.label}`,
    });
  }
  if (card.edition) {
    const art = EDITION_ART[card.edition];
    marks.push({
      id: `edition-${card.edition}`,
      slot: "top-right",
      sprite: art.sprite,
      fill: art.fill,
      highlight: art.highlight,
      label: art.label,
      detail: `판본 · ${art.label}`,
    });
  }
  if (card.seal) {
    const art = SEAL_ART[card.seal];
    marks.push({
      id: `seal-${card.seal}`,
      slot: "bottom-right",
      sprite: art.sprite,
      fill: art.fill,
      highlight: art.highlight,
      label: art.label,
      detail: `낙관 · ${art.label}`,
    });
  }
  const effect = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
  if (effect) {
    const art = EFFECT_ART[effect.id] ?? { sprite: "star" as MarkSprite, fill: RED };
    marks.push({
      id: `effect-${effect.id.replaceAll("_", "-")}`,
      slot: "mid-left",
      sprite: art.sprite,
      fill: art.fill,
      highlight: art.highlight,
      label: effect.name,
      detail: `${effect.name} · ${effect.description}`,
    });
  }

  return marks;
}

/** Lines for the hover panel, one per thing riding on the card. */
export function getCardModifierLines(card: CardInstance): string[] {
  return getCardMarks(card).map((mark) => mark.detail);
}
