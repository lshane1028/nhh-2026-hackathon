import type {
  CollectionYakuDefinition,
  CollectionYakuId,
  ImmediateYakuDefinition,
  ImmediateYakuId,
} from "../types";

/**
 * 짓고땡 족보.
 *
 * A submission is split into 짓 (the cards whose month sum is a multiple of
 * ten, worth the 월 합) and 끗패 (the last two cards, judged as a 섯다 hand and
 * worth the 배수). These definitions cover the 끗패 only.
 *
 * 땡 and 끗 both cover a range of ranks, so their `baseHeung` is the floor for
 * the family and the engine adds a rank bonus on top — see `rankBonusHeung` in
 * engine/yaku.ts. That keeps the score breakdown readable ("9끗 +2.7") instead
 * of hiding the rank inside a base number.
 */
export const IMMEDIATE_YAKU_DEFINITIONS: readonly ImmediateYakuDefinition[] = [
  { id: "mangtong", name: "망통", description: "끗패 두 장의 월 합이 10으로 나누어떨어짐. 가장 낮은 끗패", baseKkeut: 0, baseHeung: 1, growthKkeut: 0, growthHeung: 0.2, assetTag: "yaku-mangtong" },
  { id: "kkeut", name: "끗", description: "끗패 두 장의 월 합 끝자리가 1~8. 끝자리가 클수록 배수가 큼", baseKkeut: 0, baseHeung: 1, growthKkeut: 0, growthHeung: 0.2, assetTag: "yaku-kkeut" },
  { id: "gabo", name: "갑오", description: "끗패 두 장의 월 합 끝자리가 9. 끗 중 최고", baseKkeut: 0, baseHeung: 4, growthKkeut: 0, growthHeung: 0.3, assetTag: "yaku-gabo" },
  { id: "seryuk", name: "세륙", description: "4월과 6월", baseKkeut: 0, baseHeung: 4.5, growthKkeut: 0, growthHeung: 0.35, assetTag: "yaku-seryuk" },
  { id: "jangsa", name: "장사", description: "4월과 10월", baseKkeut: 0, baseHeung: 5, growthKkeut: 0, growthHeung: 0.35, assetTag: "yaku-jangsa" },
  { id: "jangpping", name: "장삥", description: "1월과 10월", baseKkeut: 0, baseHeung: 5.5, growthKkeut: 0, growthHeung: 0.35, assetTag: "yaku-jangpping" },
  { id: "gupping", name: "구삥", description: "1월과 9월", baseKkeut: 0, baseHeung: 6, growthKkeut: 0, growthHeung: 0.35, assetTag: "yaku-gupping" },
  { id: "doksa", name: "독사", description: "1월과 4월", baseKkeut: 0, baseHeung: 6.5, growthKkeut: 0, growthHeung: 0.35, assetTag: "yaku-doksa" },
  { id: "ali", name: "알리", description: "1월과 2월", baseKkeut: 0, baseHeung: 7, growthKkeut: 0, growthHeung: 0.4, assetTag: "yaku-ali" },
  { id: "ttaeng", name: "땡", description: "같은 월 두 장. 월이 높을수록 배수가 큼", baseKkeut: 0, baseHeung: 8, growthKkeut: 0, growthHeung: 0.5, assetTag: "yaku-ttaeng" },
  { id: "jangttaeng", name: "장땡", description: "10월 두 장. 광땡을 빼면 최고 끗패", baseKkeut: 0, baseHeung: 14, growthKkeut: 0, growthHeung: 0.6, assetTag: "yaku-jangttaeng" },
];

/** Bright pairs. Rare enough to stay hidden until the player finds one. */
export const SECRET_YAKU_DEFINITIONS: readonly ImmediateYakuDefinition[] = [
  { id: "gwangttaeng_13", name: "13광땡", description: "1월 광과 3월 광", baseKkeut: 0, baseHeung: 16, growthKkeut: 0, growthHeung: 0.6, assetTag: "yaku-secret-gwangttaeng-13", secret: true },
  { id: "gwangttaeng_18", name: "18광땡", description: "1월 광과 8월 광", baseKkeut: 0, baseHeung: 18, growthKkeut: 0, growthHeung: 0.6, assetTag: "yaku-secret-gwangttaeng-18", secret: true },
  { id: "gwangttaeng_38", name: "38광땡", description: "3월 광과 8월 광. 가장 높은 끗패", baseKkeut: 0, baseHeung: 20, growthKkeut: 0, growthHeung: 0.7, assetTag: "yaku-secret-gwangttaeng-38", secret: true },
];

export const ALL_IMMEDIATE_YAKU_DEFINITIONS: readonly ImmediateYakuDefinition[] = [
  ...IMMEDIATE_YAKU_DEFINITIONS,
  ...SECRET_YAKU_DEFINITIONS,
];

/** The collection board. Unchanged by the 짓고땡 switch. */
export const COLLECTION_YAKU_DEFINITIONS: readonly CollectionYakuDefinition[] = [
  { id: "hongdan", name: "홍단", description: "1·2·3월 홍단", completionKkeut: 0, completionHeung: 4, growthKkeut: 0, growthHeung: 0.25, required: 3, assetTag: "yaku-collection-hongdan" },
  { id: "chodan", name: "초단", description: "4·5·7월 초단", completionKkeut: 0, completionHeung: 4, growthKkeut: 0, growthHeung: 0.25, required: 3, assetTag: "yaku-collection-chodan" },
  { id: "cheongdan", name: "청단", description: "6·9·10월 청단", completionKkeut: 0, completionHeung: 4, growthKkeut: 0, growthHeung: 0.25, required: 3, assetTag: "yaku-collection-cheongdan" },
  { id: "godori", name: "고도리", description: "2·4·8월 새 동물", completionKkeut: 0, completionHeung: 5, growthKkeut: 0, growthHeung: 0.25, required: 3, assetTag: "yaku-collection-godori" },
  { id: "rain_three_brights", name: "비삼광", description: "비광을 포함한 광 세 장", completionKkeut: 0, completionHeung: 4, growthKkeut: 0, growthHeung: 0.25, required: 3, assetTag: "yaku-collection-rain-three-brights" },
  { id: "three_brights", name: "삼광", description: "비광 없는 광 세 장", completionKkeut: 0, completionHeung: 5, growthKkeut: 0, growthHeung: 0.25, required: 3, assetTag: "yaku-collection-three-brights" },
  { id: "four_brights", name: "사광", description: "광 네 장", completionKkeut: 0, completionHeung: 6, growthKkeut: 0, growthHeung: 0.25, required: 4, assetTag: "yaku-collection-four-brights" },
  { id: "five_brights", name: "오광", description: "광 다섯 장", completionKkeut: 0, completionHeung: 8, growthKkeut: 0, growthHeung: 0.25, required: 5, assetTag: "yaku-collection-five-brights" },
];

const immediateById = new Map(ALL_IMMEDIATE_YAKU_DEFINITIONS.map((definition) => [definition.id, definition]));
const collectionById = new Map(COLLECTION_YAKU_DEFINITIONS.map((definition) => [definition.id, definition]));

/** User-facing labels must never leak ids such as `ttaeng` into the result UI. */
export function getYakuDisplayName(id: string): string {
  return immediateById.get(id as ImmediateYakuId)?.name
    ?? collectionById.get(id as CollectionYakuId)?.name
    ?? "기록된 끗패";
}

export function getYakuAssetTag(id: string): string | null {
  return immediateById.get(id as ImmediateYakuId)?.assetTag
    ?? collectionById.get(id as CollectionYakuId)?.assetTag
    ?? null;
}

export function getImmediateYakuDefinition(id: ImmediateYakuId): ImmediateYakuDefinition {
  const definition = immediateById.get(id);
  if (!definition) throw new Error(`Unknown immediate yaku: ${id}`);
  return definition;
}

export function getCollectionYakuDefinition(id: CollectionYakuId): CollectionYakuDefinition {
  const definition = collectionById.get(id);
  if (!definition) throw new Error(`Unknown collection yaku: ${id}`);
  return definition;
}
