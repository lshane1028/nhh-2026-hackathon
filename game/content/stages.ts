import type { Month, WeatherId } from "../types";

export interface StageDefinition {
  stage: number;
  month: Month;
  name: string;
  subtitle: string;
  target: number;
  bossId: string | null;
  weatherId: WeatherId;
  assetTag: string;
}

export const STAGES: StageDefinition[] = [
  { stage: 1, month: 1, name: "송학의 첫판", subtitle: "월쌍과 월 합×배수를 익힌다", target: 120, bossId: null, weatherId: "clear", assetTag: "stage_01_pine_crane" },
  { stage: 2, month: 2, name: "매화의 갈림길", subtitle: "부적과 수집패를 연결한다", target: 190, bossId: null, weatherId: "wind", assetTag: "stage_02_plum_bird" },
  { stage: 3, month: 3, name: "봄 두목 · 고집쟁이", subtitle: "성공한 고를 포함해 스톱하라", target: 320, bossId: "boss_stubborn", weatherId: "clear", assetTag: "stage_03_cherry_boss" },
  { stage: 4, month: 4, name: "등나무 바람", subtitle: "연월과 새 태그가 흔들린다", target: 520, bossId: null, weatherId: "wind", assetTag: "stage_04_wisteria" },
  { stage: 5, month: 5, name: "난초 마당", subtitle: "높은 월 카드로 월 합을 키운다", target: 840, bossId: null, weatherId: "clear", assetTag: "stage_05_orchid" },
  { stage: 6, month: 6, name: "여름 두목 · 장마", subtitle: "비가 아닌 광이 약해진다", target: 1_400, bossId: "boss_monsoon", weatherId: "rain", assetTag: "stage_06_peony_boss" },
  { stage: 7, month: 7, name: "홍싸리 흔들기", subtitle: "같은 월 세 장으로 흔들기를 노린다", target: 2_300, bossId: null, weatherId: "wind", assetTag: "stage_07_bush_clover" },
  { stage: 8, month: 8, name: "공산명월", subtitle: "광과 새가 동시에 열린다", target: 3_800, bossId: null, weatherId: "clear", assetTag: "stage_08_full_moon" },
  { stage: 9, month: 9, name: "가을 두목 · 역달력", subtitle: "연월의 방향이 뒤집힌다", target: 6_400, bossId: "boss_reverse_calendar", weatherId: "clear", assetTag: "stage_09_chrysanthemum_boss" },
  { stage: 10, month: 10, name: "단풍 사냥", subtitle: "가장 많이 쓴 월을 시험한다", target: 10_800, bossId: null, weatherId: "wind", assetTag: "stage_10_maple_deer" },
  { stage: 11, month: 11, name: "오동의 먹구름", subtitle: "월 합이 흔들려도 엔진은 돈다", target: 18_000, bossId: null, weatherId: "snow", assetTag: "stage_11_paulownia" },
  { stage: 12, month: 12, name: "겨울 두목 · 나가리 왕", subtitle: "열두 달의 마지막 베팅", target: 30_000, bossId: "boss_nagari_king", weatherId: "rain", assetTag: "stage_12_rain_boss" },
];

export function getStageDefinition(stage: number, infiniteLap = 0): StageDefinition {
  const base = STAGES[(stage - 1) % STAGES.length];
  const lap = infiniteLap + Math.floor((stage - 1) / STAGES.length);
  if (lap === 0) return base;
  return {
    ...base,
    stage,
    name: `무한 달력 ${lap}바퀴 · ${base.name}`,
    subtitle: `${base.subtitle} / 목표 ×${(1.6 ** lap).toFixed(2)}`,
    target: Math.floor(base.target * 1.6 ** lap),
    assetTag: `${base.assetTag}_infinite_${lap}`,
  };
}
