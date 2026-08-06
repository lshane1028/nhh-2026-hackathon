import type { GameState } from "@/game/types";

export interface TutorialStep {
  id: string;
  /** Matches a `data-tutorial` attribute in the DOM. */
  target: string;
  title: string;
  body: string;
  /** Shown instead of the Next button when the player has to act. */
  actionHint?: string;
  nextLabel?: string;
  /** Step is skipped unless this holds. */
  when?: (state: GameState) => boolean;
  /** Auto-advances as soon as this holds — used for "do it yourself" steps. */
  doneWhen?: (state: GameState) => boolean;
}

/**
 * The first month is a scripted lesson. Each step dims everything except one
 * element; steps with `doneWhen` wait for the player to actually do the thing
 * instead of handing them a Next button.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "goal",
    target: "rail-goal",
    title: "이 판의 목표",
    body: "여기 적힌 점수를 넘기면 이 판을 이깁니다. 아래 막대는 지금까지 모은 점수입니다.",
  },
  {
    id: "hand",
    target: "hand",
    title: "손패를 눌러 고릅니다",
    body: "드래그는 없습니다. 카드를 누르면 위로 올라오고, 최대 다섯 장까지 고를 수 있습니다. 카드 왼쪽 위 숫자가 그 패의 월입니다.",
    actionHint: "카드 두 장을 눌러 보세요",
    doneWhen: (state) => state.selectedCardIds.length >= 2 || state.roundSubmissionIndex >= 1,
  },
  {
    id: "formula",
    target: "rail-formula",
    title: "월 합 × 배수",
    body: "고른 카드의 월 숫자를 더한 값이 왼쪽 파란 숫자, 족보와 수집·부적이 만든 값이 오른쪽 붉은 숫자입니다. 둘을 곱한 값이 이번 손 점수입니다. 족보는 가장 점수가 높은 것이 자동으로 붙습니다.",
  },
  {
    id: "submit",
    target: "submit",
    title: "점수를 냅니다",
    body: "제출하면 이 점수가 판에 쌓이고, 낼 기회가 하나 줄어듭니다.",
    actionHint: "‘족보 제출’을 눌러 보세요",
    doneWhen: (state) => state.roundSubmissionIndex >= 1,
  },
  {
    id: "discard",
    target: "discard",
    title: "쓸모없는 패는 버립니다",
    body: "고른 카드를 버리면 그만큼 새로 뽑습니다. 버리기는 점수를 내지 않지만 원하는 조합을 찾는 가장 빠른 방법입니다.",
  },
  {
    id: "shake",
    target: "shake",
    title: "흔들기",
    body: "같은 월 세 장을 함께 고르면 흔들기를 선언할 수 있습니다. 이번 판 정산이 15% 늘고, 마당에 같은 월이 깔려 있으면 폭탄이 되어 월 합까지 크게 오릅니다.",
  },
  {
    id: "collection",
    target: "collection",
    title: "수집판",
    body: "낸 카드는 광·동물·고도리·띠·피 줄에 쌓입니다. 줄이 채워질수록 다음 손의 배수가 커집니다. 한 판 안에서만 유지됩니다.",
  },
  {
    id: "talisman",
    target: "talisman",
    title: "부적",
    body: "장터에서 산 부적은 가지고 있는 동안 매 손 자동으로 발동합니다. 점선 칸은 아직 비어 있는 자리입니다.",
  },
  {
    id: "go",
    target: "go",
    title: "고를 외쳐 보세요",
    body: "목표를 넘겼습니다. 스톱하면 지금 판돈을 받고 끝납니다. 고를 외치면 문턱이 1.5배로 오르는 대신 판돈도 1.5배가 됩니다. 대신 남은 제출로 그 문턱을 못 넘기면 런이 끝납니다.",
    actionHint: "‘1고’를 눌러 보세요",
    when: (state) => state.screen === "decision" || state.chain.goCount >= 1,
    doneWhen: (state) => state.chain.goCount >= 1 || state.stage >= 2,
  },
  {
    id: "stop",
    target: "stop",
    title: "이번엔 스톱",
    body: "고를 한 번 걸어 판돈을 키웠습니다. 여기서 스톱하면 불어난 판돈을 그대로 받고 판이 끝납니다.",
    actionHint: "‘스톱’을 눌러 판을 끝내세요",
    when: (state) => state.chain.goCount >= 1,
    doneWhen: (state) =>
      state.screen === "reward" || state.screen === "shop" || state.stage >= 2,
  },
  {
    id: "reward",
    target: "reward-continue",
    title: "판돈",
    body: "이긴 판에서 받은 냥입니다. 남은 제출과 고 단계가 많을수록 더 받습니다.",
    actionHint: "‘보상 받기’를 눌러 장터로 가세요",
    when: (state) => state.screen === "reward",
    doneWhen: (state) => state.screen === "shop" || state.stage >= 2,
  },
  {
    id: "shop",
    target: "shop-rack",
    title: "장터",
    body: "부적·화공·비결서·금단 네 종류가 한 줄에 놓입니다. 부적은 자동 효과, 화공은 카드 개조, 비결서는 족보 배수, 금단은 대가가 따르는 강한 효과입니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "shop-buy",
    target: "shop-pick",
    title: "첫 부적을 사 보세요",
    body: "‘첫 부적’은 어떤 족보로 내든 배수에 +4를 더합니다. 가장 알기 쉬운 효과라 첫 구매로 좋습니다.",
    actionHint: "‘첫 부적’을 눌러 구매하세요",
    when: (state) => state.screen === "shop",
    doneWhen: (state) => state.talismans.length >= 1 || state.stage >= 2,
  },
  {
    id: "shop-leave",
    target: "shop-leave",
    title: "다음 판으로",
    body: "장터를 떠나면 2월이 시작됩니다. 여기서부터는 안내 없이 직접 판단하게 됩니다.",
    actionHint: "‘다음 판으로’를 눌러 보세요",
    when: (state) => state.screen === "shop",
    doneWhen: (state) => state.stage >= 2,
  },
];
