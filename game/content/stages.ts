import type { Month, WeatherId } from "../types";
import { BOSSES } from "./bosses";

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

/**
 * Targets, tuned against game/tests/balance-probe.test.ts.
 *
 * Re-tuned once the 월 합 numbers were scaled up (먹칠 +3 → +25, 금박 +5 → +40)
 * and the collection board started multiplying instead of adding. The base
 * deck carries no 각인, so the first few stages barely moved — the difference
 * shows up later, once a deck has been built, which is why the tail is much
 * steeper than it used to be.
 *
 * That probe brute-forces the best legal 2~5장 submission out of every 8-card
 * hand with no upgrades at all, and lands on ~1,000 points per four-hand round.
 * A person is not a brute-force search, so the real no-upgrade ceiling is closer
 * to 400~600. The ladder is set from those two numbers:
 *
 *   1~3   clearable on raw 짓 + 끗패, no shop needed
 *   4~6   crosses the no-upgrade ceiling, so talismans start to matter
 *   7~12  ~1.65x per stage, which only the 배수 engine can keep up with
 *
 * 월 합 is capped by the 짓 (10 / 20 / 30) plus card 각인, so all the growth
 * past stage 6 has to come from the 배수 side.
 */
export const STAGES: StageDefinition[] = [
  { stage: 1, month: 1, name: "송학의 첫판", subtitle: "짓과 끗패를 익힌다", target: 150, bossId: null, weatherId: "clear", assetTag: "stage_01_pine_crane" },
  { stage: 2, month: 2, name: "매화의 갈림길", subtitle: "부적과 수집패를 연결한다", target: 280, bossId: null, weatherId: "wind", assetTag: "stage_02_plum_bird" },
  { stage: 3, month: 3, name: "봄 두목 · 고집쟁이", subtitle: "성공한 고를 포함해 스톱하라", target: 450, bossId: "boss_stubborn", weatherId: "clear", assetTag: "stage_03_cherry_boss" },
  { stage: 4, month: 4, name: "등나무 바람", subtitle: "짓을 20으로 키워 본다", target: 850, bossId: null, weatherId: "wind", assetTag: "stage_04_wisteria" },
  { stage: 5, month: 5, name: "난초 마당", subtitle: "높은 월 카드로 짓 30을 노린다", target: 1_450, bossId: null, weatherId: "clear", assetTag: "stage_05_orchid" },
  { stage: 6, month: 6, name: "여름 두목 · 장마", subtitle: "비가 아닌 광이 약해진다", target: 2_450, bossId: "boss_monsoon", weatherId: "rain", assetTag: "stage_06_peony_boss" },
  { stage: 7, month: 7, name: "홍싸리 마당", subtitle: "짓을 길게 짜 배수를 얹는다", target: 4_100, bossId: null, weatherId: "wind", assetTag: "stage_07_bush_clover" },
  { stage: 8, month: 8, name: "공산명월", subtitle: "광이 열리고 광땡이 보인다", target: 6_800, bossId: null, weatherId: "clear", assetTag: "stage_08_full_moon" },
  { stage: 9, month: 9, name: "가을 두목 · 안개 병풍", subtitle: "가려진 패를 확인하고 선택 순서를 정한다", target: 11_200, bossId: "boss_reverse_calendar", weatherId: "clear", assetTag: "stage_09_chrysanthemum_boss" },
  { stage: 10, month: 10, name: "단풍 사냥", subtitle: "장땡과 장삥이 손에 잡힌다", target: 18_500, bossId: null, weatherId: "wind", assetTag: "stage_10_maple_deer" },
  { stage: 11, month: 11, name: "오동의 먹구름", subtitle: "짓이 막혀도 부적 조합으로 돌파한다", target: 30_500, bossId: null, weatherId: "snow", assetTag: "stage_11_paulownia" },
  { stage: 12, month: 12, name: "겨울 두목 · 나가리 왕", subtitle: "열두 달의 마지막 베팅", target: 50_000, bossId: "boss_nagari_king", weatherId: "rain", assetTag: "stage_12_rain_boss" },
];

const INFINITE_WEATHER_ROTATION: readonly WeatherId[] = ["clear", "wind", "rain", "snow"];

function getInfiniteWeather(base: WeatherId, lap: number): WeatherId {
  const index = INFINITE_WEATHER_ROTATION.indexOf(base);
  return INFINITE_WEATHER_ROTATION[(Math.max(0, index) + lap) % INFINITE_WEATHER_ROTATION.length];
}

function getInfiniteBoss(base: StageDefinition, lap: number): StageDefinition["bossId"] {
  if (base.bossId) return base.bossId;
  // Four non-boss months per lap gain a deterministic roaming boss. This adds
  // variation without introducing another source of non-replayable randomness.
  if ((base.month + lap) % 3 !== 0) return null;
  return BOSSES[(base.month * 5 + lap) % BOSSES.length]?.id ?? null;
}

export function getStageDefinition(stage: number, infiniteLap = 0): StageDefinition {
  const base = STAGES[(stage - 1) % STAGES.length];
  const lap = infiniteLap + Math.floor((stage - 1) / STAGES.length);
  if (lap === 0) return base;
  const bossId = getInfiniteBoss(base, lap);
  const weatherId = getInfiniteWeather(base.weatherId, lap);
  const roamingBoss = bossId && bossId !== base.bossId
    ? BOSSES.find((boss) => boss.id === bossId)
    : null;
  const variation = roamingBoss
    ? `떠돌이 두목 · ${roamingBoss.name}`
    : `날씨 변주 · ${weatherId === "clear" ? "맑음" : weatherId === "wind" ? "바람" : weatherId === "rain" ? "비" : "눈"}`;
  return {
    ...base,
    stage,
    name: `무한 달력 ${lap}바퀴 · ${base.name}`,
    subtitle: `${base.subtitle} / 목표 ×${(1.6 ** lap).toFixed(2)} / ${variation}`,
    target: Math.floor(base.target * 1.6 ** lap),
    bossId,
    weatherId,
    assetTag: `${base.assetTag}_infinite_${lap}`,
  };
}
