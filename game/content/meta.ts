import type {
  ContractDefinition,
  PackDefinition,
  StartDeckDefinition,
  WeatherDefinition,
} from "../types";

export const START_DECKS = [
  {
    id: "deck_standard",
    name: "정석패",
    description: "아무 변형 없는 기본 화투 48장으로 시작.",
    effectKey: "standard_48",
    assetTag: "start-deck:standard",
    unlockStage: 0,
  },
  {
    id: "deck_red",
    name: "붉은 상",
    description: "매 판 버리기 +1. 원하는 패를 더 쉽게 찾는 입문 덱.",
    effectKey: "extra_discard",
    assetTag: "start-deck:red",
    unlockStage: 3,
  },
  {
    id: "deck_blue",
    name: "푸른 상",
    description: "매 판 제출 +1. 더 많은 손으로 안전하게 점수를 쌓는 덱.",
    effectKey: "extra_hand",
    assetTag: "start-deck:blue",
    unlockStage: 6,
  },
  {
    id: "deck_black",
    name: "검은 상",
    description: "부적 슬롯 +1, 제출 -1. 적은 기회에 부적 조합을 완성하는 고난도 덱.",
    effectKey: "talisman_slot_up_hand_down",
    assetTag: "start-deck:black",
    unlockStage: 9,
  },
  {
    id: "deck_money",
    name: "금전패",
    description: "12냥을 추가로 가지고 시작해 장터 선택을 앞당기는 덱.",
    effectKey: "start_with_12_money",
    assetTag: "start-deck:money",
    unlockStage: 12,
  },
] as const satisfies readonly StartDeckDefinition[];

export const PACKS = [
  {
    id: "pack_hwatu_small",
    name: "화투 묶음",
    description: "후보 3장 중 1장을 골라 덱에 넣습니다.",
    category: "card",
    price: 4,
    choices: 3,
    picks: 1,
    assetTag: "pack:hwatu-small",
  },
  {
    id: "pack_hwatu_large",
    name: "큰 화투 묶음",
    description: "후보 5장 중 2장을 골라 덱에 넣습니다.",
    category: "card",
    price: 7,
    choices: 5,
    picks: 2,
    assetTag: "pack:hwatu-large",
  },
] as const satisfies readonly PackDefinition[];

/** 기본 계약과 대응 상위 계약을 한 레코드로 묶은 8쌍. */
export const CONTRACTS = [
  {
    id: "contract_extra_hand",
    name: "여분 손목",
    description: "매 판 제출 기회 +1.",
    upgradedName: "네 손 타짜",
    upgradedDescription: "제출 기회를 추가로 +1해 기본 대비 총 +2.",
    effectKey: "hands_per_round",
    assetTag: "contract:extra-hand",
  },
  {
    id: "contract_extra_discard",
    name: "패갈이",
    description: "매 판 버리기 기회 +1.",
    upgradedName: "새 판",
    upgradedDescription: "버리기 기회를 추가로 +1해 기본 대비 총 +2.",
    effectKey: "discards_per_round",
    assetTag: "contract:extra-discard",
  },
  {
    id: "contract_large_table",
    name: "큰 상",
    description: "손패 크기 +1.",
    upgradedName: "대청마루",
    upgradedDescription: "손패 크기를 추가로 +1해 기본 대비 총 +2.",
    effectKey: "hand_size",
    assetTag: "contract:large-table",
  },
  {
    id: "contract_talisman_pouch",
    name: "부적 주머니",
    description: "소모품 보관 슬롯 +1.",
    upgradedName: "오방낭",
    upgradedDescription: "부적 슬롯 +1을 추가로 획득.",
    effectKey: "inventory_slots",
    assetTag: "contract:talisman-pouch",
  },
  {
    id: "contract_regular_stamp",
    name: "단골 도장",
    description: "모든 장터 가격 15% 할인.",
    upgradedName: "안방 손님",
    upgradedDescription: "총 할인율을 30%로 높임.",
    effectKey: "shop_discount",
    assetTag: "contract:regular-stamp",
  },
  {
    id: "contract_bargaining_sheet",
    name: "흥정표",
    description: "장터에서 물건을 바꾸는 기본 비용 -1냥.",
    upgradedName: "도매 장부",
    upgradedDescription: "같은 장터에서 물건을 여러 번 바꿔도 비용이 오르지 않음.",
    effectKey: "reroll_cost",
    assetTag: "contract:bargaining-sheet",
  },
  {
    id: "contract_bookshop",
    name: "동네 책방",
    description: "서책방과 묶음에서 비결서 출현률 상승.",
    upgradedName: "대서고",
    upgradedDescription: "가장 많이 사용한 족보의 비결서가 비결 묶음에 보장.",
    effectKey: "book_weight",
    assetTag: "contract:bookshop",
  },
  {
    id: "contract_painter_guild",
    name: "화공 조합",
    description: "강화된 카드와 화공패의 출현률 상승.",
    upgradedName: "명장 조합",
    upgradedDescription: "판본·낙관이 붙은 카드도 장터 후보로 출현 가능.",
    effectKey: "modified_card_weight",
    assetTag: "contract:painter-guild",
  },
] as const satisfies readonly ContractDefinition[];

export const WEATHER = [
  {
    id: "clear",
    name: "맑음",
    description: "추가 규칙이 없는 기본 날씨.",
    assetTag: "weather:clear",
  },
  {
    id: "rain",
    name: "비",
    description: "비 태그 또는 12월 카드가 득점할 때 월 합 +6.",
    assetTag: "weather:rain",
  },
  {
    id: "wind",
    name: "바람",
    description: "새 태그 카드가 득점할 때 월 합 +4.",
    assetTag: "weather:wind",
  },
  {
    id: "snow",
    name: "눈",
    description: "광 카드는 월 합 +5, 피 카드는 월 합 -1. 다른 종류는 변화 없음.",
    assetTag: "weather:snow",
  },
] as const satisfies readonly WeatherDefinition[];

export const START_DECK_BY_ID = Object.fromEntries(
  START_DECKS.map((definition) => [definition.id, definition]),
) as Record<string, (typeof START_DECKS)[number]>;

export const PACK_BY_ID = Object.fromEntries(
  PACKS.map((definition) => [definition.id, definition]),
) as Record<string, (typeof PACKS)[number]>;

export const CONTRACT_BY_ID = Object.fromEntries(
  CONTRACTS.map((definition) => [definition.id, definition]),
) as Record<string, (typeof CONTRACTS)[number]>;

export const WEATHER_BY_ID = Object.fromEntries(
  WEATHER.map((definition) => [definition.id, definition]),
) as Record<string, (typeof WEATHER)[number]>;
