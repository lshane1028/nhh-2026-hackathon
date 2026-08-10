import type { CardInstance } from "@/game/types";
import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import type { MarkSprite } from "./CardMark";

/**
 * How a card shows what is riding on it.
 *
 * A card can carry four things at once — an 각인, a 판본, a 낙관 and an effect
 * tag — and packs deliberately roll doubles, so all four have to be legible
 * simultaneously.
 *
 * The trick is not to make four badges more distinct from each other. It is to
 * stop them being the same KIND of thing. Balatro reads cleanly with three
 * modifiers stacked because each one is a different physical fact about the
 * card, and two different facts cannot occupy the same pixels:
 *
 *   MATERIAL  what the card is made of      → the whole face   → 각인
 *   SURFACE   how it catches the light      → a sheen over it  → 판본
 *   OBJECT    what is stuck to it           → a corner         → 낙관, effect
 *
 * A glass card with a red wax seal and a foil finish reads as all three at
 * once, because "made of glass", "has a blob of wax on it" and "shines" are
 * answers to different questions. Four badges in four corners are answers to
 * the same question, which is why the old version looked like clutter no
 * matter how the badges were drawn.
 *
 * 각인 used to steal the surface — 유리패 and 복패 were drawn as surfaces — which
 * silently meant a glass card could never show its 판본. Materials and surfaces
 * are separate layers now, so it can.
 *
 * Deliberately NOT a rainbow anywhere. A hwatu card is already red, black, gold
 * and cream; a spectrum on top turns it into noise.
 */

/** How the card catches light. 판본 only — one card, one finish. */
export type CardSurface = "gold_leaf" | "mother_of_pearl" | "five_color" | "engraved" | null;

/** What the card is made of. 각인 only. */
export type CardMaterial = NonNullable<CardInstance["enhancement"]>;

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

/*
  Names only. 각인 and 판본 are drawn as the material and the finish, not as
  tokens, so all they need here is the wording for the hover panel.
*/
export const MATERIAL_LABELS: Record<CardMaterial, string> = {
  inked: "먹칠",
  scarlet: "홍칠",
  wild: "만능화",
  glass: "유리패",
  steel: "강철패",
  stone: "돌패",
  coin: "금전패",
  fortune: "복패",
};

export const SURFACE_LABELS: Record<NonNullable<CardSurface>, string> = {
  gold_leaf: "금박",
  mother_of_pearl: "자개",
  five_color: "오방색",
  engraved: "음각",
};

/* Names and trigger glyphs for the lacquer-stamp layer rendered by HwatuCard. */
export const SEAL_LABELS: Record<NonNullable<CardInstance["seal"]>, string> = {
  yellow: "황인",
  red: "적인",
  blue: "청인",
  purple: "자인",
};

/** Colour is never the only identifier: every modifier also owns a glyph. */
export const MATERIAL_GLYPHS: Record<CardMaterial, string> = {
  inked: "墨",
  scarlet: "倍",
  wild: "萬",
  glass: "璃",
  steel: "鋼",
  stone: "石",
  coin: "錢",
  fortune: "福",
};

export const SURFACE_GLYPHS: Record<NonNullable<CardSurface>, string> = {
  gold_leaf: "金",
  mother_of_pearl: "螺",
  five_color: "彩",
  engraved: "刻",
};

export interface SealVisual {
  glyph: string;
  cue: string;
}

export const SEAL_VISUALS: Record<NonNullable<CardInstance["seal"]>, SealVisual> = {
  yellow: { glyph: "냥", cue: "득점 보상" },
  red: { glyph: "再", cue: "한 번 더" },
  blue: { glyph: "留", cue: "손에 보유" },
  purple: { glyph: "棄", cue: "버릴 때" },
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
 * The finish. 판본 and nothing else.
 *
 * No contest to resolve any more, which is the point: 각인 answers "what is it
 * made of" and 판본 answers "how does it shine", so neither has to lose. The
 * old version had 유리패 and 복패 outrank the edition for this slot, meaning a
 * glass card silently threw its 판본 away and the player was never told.
 */
export function getCardSurface(card: CardInstance): CardSurface {
  return card.edition ?? null;
}

/** What it is made of. 각인 and nothing else. */
export function getCardMaterial(card: CardInstance): CardMaterial | null {
  return card.enhancement ?? null;
}

/**
 * Which effects get the trading-card foil.
 *
 * Deliberately almost empty. The foil is the loudest thing the card can do, so
 * it is worth exactly one effect at a time — put it on everything and it stops
 * marking anything out. 무거운 달 has it because +50 to the month sum is the
 * single biggest number a card can carry, and it should be the one you spot
 * across the table.
 *
 * One warm hue, never a spectrum: the art is already red, black, gold and
 * cream, and a rainbow over that is noise rather than shine.
 */
export type CardShine = "gilt" | null;

const SHINE_BY_EFFECT: Record<string, CardShine> = {
  heavy_month: "gilt",
};

export function getCardShine(card: CardInstance): CardShine {
  if (!card.effectTagId) return null;
  return SHINE_BY_EFFECT[card.effectTagId] ?? null;
}

/**
 * Only what is physically STUCK to the card.
 *
 * 각인 and 판본 deliberately get no token: they are the material and the finish,
 * so they are already visible across the whole face. Giving them corner tokens
 * as well was the actual problem — four tokens in four corners read as one
 * cluttered pile no matter how carefully each is drawn, because they all answer
 * the same question.
 *
 * 낙관 is rendered by its own lacquer-stamp layer rather than as a CardMark,
 * so it cannot collide with the effect title strip.
 *
 * So this is the effect tag alone right now. Every name still reaches the
 * player through the hover panel, which is where they go for exact wording.
 */
export function getCardMarks(card: CardInstance): CardMarkSpec[] {
  const marks: CardMarkSpec[] = [];

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

/**
 * Lines for the hover panel, one per thing riding on the card.
 *
 * Covers all four categories, not just the two that get objects. The face
 * tells you a card is made of glass; this is where you find out it is 유리패
 * and what 유리패 costs you.
 */
export function getCardModifierLines(card: CardInstance): string[] {
  const lines: string[] = [];
  if (card.enhancement) lines.push(`각인 · ${MATERIAL_LABELS[card.enhancement]}`);
  if (card.edition) lines.push(`판본 · ${SURFACE_LABELS[card.edition]}`);
  if (card.seal) lines.push(`낙관 · ${SEAL_LABELS[card.seal]}`);
  lines.push(...getCardMarks(card).map((mark) => mark.detail));
  return lines;
}
