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
    name: "홍매패",
    description: "매 판 버리기 +1. 매화 무늬처럼 패를 자주 갈아 원하는 조합을 찾는 덱.",
    effectKey: "extra_discard",
    assetTag: "start-deck:red",
    unlockStage: 3,
  },
  {
    id: "deck_blue",
    name: "청류패",
    description: "매 판 제출 +1. 물결처럼 여러 번 손을 이어 안전하게 점수를 쌓는 덱.",
    effectKey: "extra_hand",
    assetTag: "start-deck:blue",
    unlockStage: 6,
  },
  {
    id: "deck_black",
    name: "먹산패",
    description: "부적 칸 +1, 제출 -1. 적은 기회에 부적 조합을 완성하는 고난도 덱.",
    effectKey: "talisman_slot_up_hand_down",
    assetTag: "start-deck:black",
    unlockStage: 9,
  },
  {
    id: "deck_money",
    name: "엽전패",
    description: "12냥을 추가로 가지고 시작해 장터 선택을 앞당기는 덱.",
    effectKey: "start_with_12_money",
    assetTag: "start-deck:money",
    unlockStage: 12,
  },
] as const satisfies readonly StartDeckDefinition[];

export const PACKS = [
  {
    id: "pack_hwatu_small",
    name: "작은 패 꾸러미",
    description: "후보 3장 중 1장을 골라 덱에 넣습니다.",
    category: "card",
    price: 4,
    choices: 3,
    picks: 1,
    assetTag: "pack:hwatu-small",
  },
  {
    id: "pack_hwatu_medium",
    name: "넉넉한 패 꾸러미",
    description: "후보 5장 중 2장을 골라 덱에 넣습니다.",
    category: "card",
    price: 8,
    choices: 5,
    picks: 2,
    assetTag: "pack:hwatu-medium",
  },
  {
    id: "pack_hwatu_large",
    name: "대형 패 꾸러미",
    description: "후보 7장 중 3장을 골라 덱에 넣습니다.",
    category: "card",
    price: 16,
    choices: 7,
    picks: 3,
    assetTag: "pack:hwatu-large",
  },
  { id: "pack_book_small", name: "작은 비결 꾸러미", description: "비결서 3권 중 1권을 고릅니다.", category: "book", price: 6, choices: 3, picks: 1, assetTag: "pack:book-small" },
  { id: "pack_book_medium", name: "넉넉한 비결 꾸러미", description: "비결서 5권 중 2권을 고릅니다.", category: "book", price: 11, choices: 5, picks: 2, assetTag: "pack:book-medium" },
  { id: "pack_book_large", name: "대형 비결 꾸러미", description: "비결서 7권 중 3권을 고릅니다.", category: "book", price: 21, choices: 7, picks: 3, assetTag: "pack:book-large" },
  { id: "pack_talisman_small", name: "작은 부적 꾸러미", description: "부적 3장 중 1장을 고릅니다.", category: "talisman", price: 8, choices: 3, picks: 1, assetTag: "pack:talisman-small" },
  { id: "pack_talisman_medium", name: "넉넉한 부적 꾸러미", description: "부적 5장 중 2장을 고릅니다.", category: "talisman", price: 15, choices: 5, picks: 2, assetTag: "pack:talisman-medium" },
  { id: "pack_talisman_large", name: "대형 부적 꾸러미", description: "부적 7장 중 3장을 고릅니다.", category: "talisman", price: 28, choices: 7, picks: 3, assetTag: "pack:talisman-large" },
  { id: "pack_burn_small", name: "작은 소각 꾸러미", description: "현재 덱 전체에서 패 2장을 골라 확정 소각합니다.", category: "burn", price: 5, choices: 2, picks: 2, assetTag: "pack:burn-small" },
  { id: "pack_burn_large", name: "큰 소각 꾸러미", description: "현재 덱 전체에서 패 4장을 골라 확정 소각합니다.", category: "burn", price: 14, choices: 4, picks: 4, assetTag: "pack:burn-large" },
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
    description: "부적 보관 칸 +1.",
    upgradedName: "오방낭",
    upgradedDescription: "부적 보관 칸을 하나 더 늘림.",
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
    description: "장터 비결서점에 비결서가 1권 더 등장.",
    upgradedName: "대서고",
    upgradedDescription: "가장 많이 사용한 족보의 비결서가 비결 묶음에 보장.",
    effectKey: "book_weight",
    assetTag: "contract:bookshop",
  },
  {
    id: "contract_painter_guild",
    name: "화공 조합",
    description: "패 꾸러미에서 효과가 붙은 패가 더 자주 등장.",
    upgradedName: "명장 조합",
    upgradedDescription: "패 꾸러미 후보에 판본이나 낙관도 붙을 수 있음.",
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
    description: "비 그림이 있는 패 또는 12월 패가 득점할 때 월 합 +6.",
    assetTag: "weather:rain",
  },
  {
    id: "wind",
    name: "바람",
    description: "새 그림이 있는 패가 득점할 때 월 합 +4.",
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
