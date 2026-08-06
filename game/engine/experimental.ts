import type {
  CardInstance,
  ExperimentalRules,
  Month,
  WeatherId,
  YardState,
} from "../types";

export interface YardCaptureResult {
  captured: CardInstance[];
  remainingYard: CardInstance[];
  bonusKkeut: number;
  bonusHeung: number;
  swept: boolean;
  label: string;
}

export function resolveYardCapture(
  submitted: CardInstance[],
  yard: YardState,
  enabled: boolean,
): YardCaptureResult {
  if (!enabled) {
    return { captured: [], remainingYard: yard.cards, bonusKkeut: 0, bonusHeung: 0, swept: false, label: "" };
  }
  const months = new Set<Month>(submitted.map((card) => card.month));
  const captured = yard.cards.filter((card) => months.has(card.month));
  const remainingYard = yard.cards.filter((card) => !months.has(card.month));
  const swept = yard.cards.length > 0 && remainingYard.length === 0;
  return {
    captured,
    remainingYard,
    bonusKkeut: captured.length * 4 + (swept ? 18 : 0),
    bonusHeung: swept ? 1 : 0,
    swept,
    label: captured.length
      ? `같은 달 카드 ${captured.length}장 수집${swept ? " · 전부 수집!" : ""}`
      : "같은 달 카드 없음",
  };
}

export function canDeclareShake(selected: CardInstance[], rules: ExperimentalRules): boolean {
  if (!rules.bombsAndShake || selected.length !== 3) return false;
  return selected.every((card) => card.month === selected[0].month);
}

export function canDeclareBomb(
  selected: CardInstance[],
  yard: YardState,
  rules: ExperimentalRules,
): boolean {
  if (!canDeclareShake(selected, rules)) return false;
  return yard.cards.some((card) => card.month === selected[0].month);
}

export interface ShakeResult {
  settlementBonus: number;
  bonusKkeut: number;
  label: string;
}

/** What the player picks after submitting three cards of one month. */
export type ShakeChoice = "shake" | "bomb" | null;

/**
 * Two ways to cash in the same three cards: 흔들기 grows the purse at the end
 * of the round, 폭탄 pays out as raw month sum right now. Neither needs the
 * yard, so the choice is always live.
 */
export function getShakeResult(choice: ShakeChoice): ShakeResult {
  if (choice === "bomb") {
    return { settlementBonus: 0, bonusKkeut: 24, label: "폭탄 · 월 합 +24" };
  }
  if (choice === "shake") {
    return { settlementBonus: 0.2, bonusKkeut: 0, label: "흔들기 · 이번 판 판돈 +20%" };
  }
  return { settlementBonus: 0, bonusKkeut: 0, label: "" };
}

export function weatherCardModifier(card: CardInstance, weather: WeatherId): number {
  const isRain = card.tags.includes("rain") || card.month === 12;
  switch (weather) {
    case "rain":
      return isRain ? 6 : 0;
    case "wind":
      return card.tags.includes("bird") ? 4 : 0;
    case "snow":
      return card.kind === "bright" ? 5 : card.kind === "chaff" ? -1 : 0;
    default:
      return 0;
  }
}

export interface BakReward {
  id: "gwangbak" | "pibak" | "meongbak" | "none";
  name: string;
  description: string;
  bonusMoney: number;
}

export function evaluateBakContract(
  scoringKinds: string[],
  completedYakus: string[],
  enabled: boolean,
): BakReward {
  if (!enabled) return { id: "none", name: "박 없음", description: "실험 규칙 꺼짐", bonusMoney: 0 };
  if (completedYakus.some((id) => id.includes("bright"))) {
    return { id: "gwangbak", name: "광박 계약", description: "광 수집 족보 정산", bonusMoney: 3 };
  }
  if (completedYakus.includes("godori") || scoringKinds.filter((kind) => kind === "animal").length >= 4) {
    return { id: "meongbak", name: "멍박 계약", description: "동물패·고도리 중심", bonusMoney: 2 };
  }
  if (scoringKinds.filter((kind) => kind === "chaff").length >= 4) {
    return { id: "pibak", name: "피박 계약", description: "피 중심 정산", bonusMoney: 2 };
  }
  return { id: "none", name: "박 없음", description: "조건 미달", bonusMoney: 0 };
}
