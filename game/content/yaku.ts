import type {
  CollectionYakuDefinition,
  CollectionYakuId,
  ImmediateYakuDefinition,
  ImmediateYakuId,
} from "../types";

export const IMMEDIATE_YAKU_DEFINITIONS: readonly ImmediateYakuDefinition[] = [
  { id: "single", name: "홑패", description: "다른 즉시 족보가 없을 때 월 합 기여도가 가장 높은 카드 한 장", baseKkeut: 0, baseHeung: 1, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-single" },
  { id: "month_pair", name: "월쌍", description: "같은 월 두 장", baseKkeut: 0, baseHeung: 2, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-month-pair" },
  { id: "two_pairs", name: "두쌍", description: "서로 다른 두 월의 쌍", baseKkeut: 0, baseHeung: 2, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-two-pairs" },
  { id: "three_run", name: "삼연월", description: "서로 다른 연속 월 세 장", baseKkeut: 0, baseHeung: 2, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-three-run" },
  { id: "chaff_field", name: "피밭", description: "피값 합계 5 이상", baseKkeut: 0, baseHeung: 2, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-chaff-field" },
  { id: "triple_month", name: "삼동월", description: "같은 월 세 장", baseKkeut: 0, baseHeung: 3, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-triple-month" },
  { id: "four_run", name: "사연월", description: "서로 다른 연속 월 네 장", baseKkeut: 0, baseHeung: 3, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-four-run" },
  { id: "four_ribbons", name: "띠다발", description: "띠 네 장", baseKkeut: 0, baseHeung: 3, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-four-ribbons" },
  { id: "four_animals", name: "동물잔치", description: "동물 네 장", baseKkeut: 0, baseHeung: 3, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-four-animals" },
  { id: "same_season", name: "한계절", description: "같은 계절 다섯 장", baseKkeut: 0, baseHeung: 4, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-same-season" },
  { id: "house_party", name: "집들이", description: "한 월 세 장과 다른 한 월 두 장", baseKkeut: 0, baseHeung: 4, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-house-party" },
  { id: "five_run", name: "오연월", description: "서로 다른 연속 월 다섯 장", baseKkeut: 0, baseHeung: 4, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-five-run" },
  { id: "four_of_month", name: "총통", description: "같은 월 네 장", baseKkeut: 0, baseHeung: 6, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-four-of-month" },
];

export const SECRET_YAKU_DEFINITIONS: readonly ImmediateYakuDefinition[] = [
  { id: "five_of_month", name: "오통", description: "한 제출에서 같은 월 다섯 장", baseKkeut: 0, baseHeung: 9, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-secret-five-of-month", secret: true },
  { id: "double_godori", name: "쌍고도리", description: "새 태그 다섯 장이며 2·4·8월을 모두 포함", baseKkeut: 0, baseHeung: 9, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-secret-double-godori", secret: true },
  { id: "ten_thousand_pines", name: "만송학", description: "1월 다섯 장이며 광 두 장 이상", baseKkeut: 0, baseHeung: 10, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-secret-ten-thousand-pines", secret: true },
  { id: "rain_bright_world", name: "비광천하", description: "비 태그 다섯 장이며 광 세 장 이상", baseKkeut: 0, baseHeung: 10, growthKkeut: 0, growthHeung: 0.25, assetTag: "yaku-secret-rain-bright-world", secret: true },
];

export const ALL_IMMEDIATE_YAKU_DEFINITIONS: readonly ImmediateYakuDefinition[] = [
  ...IMMEDIATE_YAKU_DEFINITIONS,
  ...SECRET_YAKU_DEFINITIONS,
];

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
