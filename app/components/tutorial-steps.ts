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
    body: "오른쪽 판이 점수판입니다. 여기 적힌 점수를 넘기면 이 판을 이깁니다. 아래 막대는 지금까지 모은 점수입니다.",
  },
  {
    id: "hand",
    target: "hand",
    title: "손패를 눌러 고릅니다",
    body: "드래그는 없습니다. 카드를 누르면 위로 올라오고, 두 장부터 다섯 장까지 낼 수 있습니다. 카드 왼쪽 위 숫자가 그 패의 월입니다.",
    actionHint: "카드 두 장을 눌러 보세요",
    doneWhen: (state) => state.selectedCardIds.length >= 2 || state.roundSubmissionIndex >= 1,
  },
  {
    id: "kkeut",
    target: "hand",
    title: "두 장은 ‘끗패’가 됩니다",
    body: "고른 카드 중 두 장이 붉은 ‘끗’ 표시를 답니다. 이 두 장의 월을 더한 끝자리가 끗패의 끗수입니다. 3월과 5월이면 8끗, 끝자리가 9면 갑오, 0이면 가장 낮은 망통입니다. 같은 월 두 장이면 땡, 10월 두 장이면 장땡이고, 광 두 장이 만나면 광땡입니다. 끗패가 셀수록 배수가 커집니다.",
  },
  {
    id: "jit",
    target: "hand",
    title: "나머지는 ‘짓’입니다",
    body: "세 장 이상 낼 때, 끗패가 아닌 나머지 카드는 푸른 ‘짓’ 표시를 답니다. 짓에 들어간 카드들의 월을 더해 10의 배수가 되어야 제출이 됩니다. 그 합이 그대로 월 합이 됩니다. 4월과 6월이면 10, 여기에 10월 한 장을 더 얹으면 20입니다. 두 장만 낼 때는 짓이 없어 월 합이 1로 시작합니다.",
    actionHint: "다음을 눌러 계속하세요",
  },
  {
    id: "formula",
    target: "rail-formula",
    title: "짓(월 합) × 끗패(배수)",
    body: "왼쪽 파란 숫자가 짓이 만든 월 합, 오른쪽 붉은 숫자가 끗패와 수집·부적이 만든 배수입니다. 둘을 곱한 값이 이번 손 점수입니다. 같은 카드로 짓과 끗패를 나누는 방법이 여러 가지면 점수가 가장 높은 갈래가 자동으로 선택됩니다.",
  },
  {
    id: "submit",
    target: "submit",
    title: "점수를 냅니다",
    body: "제출하면 이 점수가 판에 쌓이고, 낼 기회가 하나 줄어듭니다. 짓이 맞지 않으면 제출 단추가 잠깁니다.",
    actionHint: "‘제출’을 눌러 보세요",
    doneWhen: (state) => state.roundSubmissionIndex >= 1,
  },
  {
    id: "discard",
    target: "discard",
    title: "쓸모없는 패는 버립니다",
    body: "고른 카드를 버리면 그만큼 새로 뽑습니다. 버리기는 점수를 내지 않지만, 짓이 맞는 월 조합을 찾는 가장 빠른 방법입니다.",
  },
  {
    id: "collection",
    target: "collection",
    title: "수집판",
    body: "왼쪽이 수집판입니다. 낸 카드는 광·동물·고도리·띠·피 줄에 쌓이고, 줄이 채워질수록 다음 손의 배수가 커집니다. 한 판 안에서만 유지됩니다.",
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
    body: "목표를 넘겼습니다. 스톱하면 지금 판돈을 받고 끝납니다. 고를 외치면 문턱이 크게 오르는 대신 판돈이 1.7배가 됩니다. 대신 남은 제출로 그 문턱을 못 넘기면 런이 끝납니다.",
    actionHint: "‘1고’를 눌러 보세요",
    when: (state) => state.screen === "decision",
    doneWhen: (state) => state.chain.goCount >= 1 || state.stage >= 2,
  },
  {
    // Fills the gap between calling Go and clearing the new bar. Without this
    // the next step told the player to press 스톱 while they were still playing.
    id: "go-chase",
    target: "go-banner",
    title: "이제 새 문턱을 넘어야 합니다",
    body: "고를 걸면 판돈이 커지는 대신 목표가 올라갑니다. 위 띠에 남은 점수가 표시됩니다. 남은 제출을 다 쓸 때까지 넘기지 못하면 런이 끝나니, 남은 손으로 넘길 수 있는지 보고 걸어야 합니다.",
    actionHint: "문턱을 넘을 때까지 계속 제출하세요",
    when: (state) => state.screen === "play" && state.chain.goCount >= 1,
    doneWhen: (state) =>
      state.screen === "decision" || state.screen === "reward" || state.screen === "shop" || state.stage >= 2,
  },
  {
    id: "stop",
    target: "stop",
    title: "이번엔 스톱",
    body: "새 문턱까지 넘겼습니다. 여기서 스톱하면 1.7배로 불어난 판돈을 그대로 받고 판이 끝납니다.",
    actionHint: "‘스톱’을 눌러 판을 끝내세요",
    // Only once the decision screen is actually open again.
    when: (state) => state.screen === "decision" && state.chain.goCount >= 1,
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
    target: "wallet",
    title: "장터에 왔습니다",
    body: "여기 있는 냥으로 물건을 삽니다. 판을 이길 때마다 늘어나고, 쓰지 않고 모아 두면 더 좋은 물건을 살 수 있습니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "dept-talisman",
    target: "dept-talisman",
    title: "부적전",
    body: "한 번 사면 이번 런 내내 남아 매 손 자동으로 발동합니다. 덱의 성격을 정하는 가장 큰 축입니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "dept-book",
    target: "dept-book",
    title: "비결서점",
    body: "적힌 끗패의 기본 배수를 영구히 한 단계 올립니다. 자주 나오는 땡이나 끗부터 키우면 매 손이 조금씩 세집니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "dept-workshop",
    target: "dept-workshop",
    title: "덱 손질방",
    body: "덱 자체를 바꾸는 곳입니다. 카드 묶음을 사면 후보 중에서 골라 덱에 넣고, 소각으로는 쓸모없어진 카드를 영구히 뺍니다. 묶음에서 나오는 카드에는 효과가 하나씩 붙어 있습니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "dept-forbidden",
    target: "dept-forbidden",
    title: "금단장",
    body: "판을 뒤집을 만큼 강하지만 반드시 영구적인 대가가 따릅니다. 덱이 자리를 잡은 뒤에 손대는 쪽이 안전합니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "shop-buy",
    target: "shop-pick",
    title: "첫 부적을 사 보세요",
    body: "‘첫 부적’은 조건 없이 배수에 +4를 더합니다. 효과가 가장 읽기 쉬워서 첫 구매로 좋습니다.",
    actionHint: "‘첫 부적’을 눌러 구매하세요",
    when: (state) => state.screen === "shop",
    doneWhen: (state) => state.talismans.length >= 1 || state.stage >= 2,
  },
  {
    id: "shop-reroll",
    target: "shop-reroll",
    title: "물건이 마음에 안 들면",
    body: "냥을 내고 장터 전체를 다시 뽑을 수 있습니다. 다시 뽑을수록 값이 오르니 아껴 쓰세요.",
    when: (state) => state.screen === "shop",
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
