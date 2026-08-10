import type { GameState } from "@/game/types";

export interface TutorialStep {
  id: string;
  /** Matches a `data-tutorial` attribute in the DOM. */
  target: string;
  title: string;
  body: string;
  /**
   * What to do on this screen, shown next to the Next button rather than in
   * place of it. The button is always available, so a hint the player cannot
   * act on right now is never a dead end.
   */
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
 *
 * `doneWhen` MUST be monotonic — once true it can never go false again. The
 * cursor is derived from game state on every render rather than stored, so a
 * predicate that flips back snaps the tutorial to an earlier step. Anything
 * the player can undo (a selection, a screen they can leave) belongs on the
 * Next button, not on `doneWhen`.
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
    body: "카드를 누르면 선택되고 다시 누르면 빠집니다. 한 번에 두 장부터 다섯 장까지 낼 수 있습니다. 카드 왼쪽 위 숫자는 그 패의 월입니다.",
    // 선택은 되돌릴 수 있으므로 doneWhen 을 두지 않는다. 카드를 골랐다가 다시
    // 빼면 튜토리얼이 이 단계로 되감기는 버그가 있었다. 다음 두 단계가 고른
    // 카드에 붙는 짓·끗 표식을 설명하므로 선택을 유지한 채 넘어가는 편이 낫다.
    nextLabel: "카드 두 장을 고르고 다음",
  },
  {
    id: "kkeut",
    target: "hand",
    title: "두 장은 ‘끗패’가 됩니다",
    body: "가장 먼저 고른 두 장이 끗패입니다. 두 패의 월을 더한 끝자리로 족보가 정해집니다. 3월과 5월은 8끗, 끝자리 9는 갑오, 끝자리 0은 망통입니다. 같은 월 두 장은 땡이며, 광 두 장은 광땡이 될 수 있습니다.",
  },
  {
    id: "jit",
    target: "hand",
    title: "나머지는 ‘짓’입니다",
    body: "세 장 이상 고르면 세 번째 패부터는 짓이 됩니다. 짓패의 월을 모두 더한 값이 10, 20, 30처럼 10의 배수가 되어야 낼 수 있습니다. 두 장만 낼 때는 짓 없이 끗패만 냅니다.",
  },
  {
    id: "formula",
    target: "rail-formula",
    title: "짓(월 합) × 끗패(배수)",
    body: "파란 숫자는 짓의 월 합, 붉은 숫자는 끗패와 부적이 만든 배수입니다. 두 값을 곱하면 이번 제출 점수가 됩니다. 끗패는 가장 먼저 고른 두 장으로 고정되므로 원하는 족보를 직접 만들 수 있습니다.",
  },
  {
    id: "submit",
    target: "submit",
    title: "점수를 냅니다",
    body: "제출하면 이 점수가 판에 쌓이고, 낼 기회가 하나 줄어듭니다. 짓이 맞지 않으면 제출 단추가 잠깁니다.",
    actionHint: "‘제출’ 누르기",
    // roundSubmissionIndex 는 판이 바뀌면 0으로 돌아가므로 stage 탈출구가 없으면
    // 단조성이 깨진다. 지금은 튜토리얼이 1월에만 붙어 있어 드러나지 않지만,
    // 범위를 넓히는 순간 이 단계로 되감긴다.
    doneWhen: (state) => state.roundSubmissionIndex >= 1 || state.stage >= 2,
  },
  {
    id: "discard",
    target: "discard",
    title: "쓸모없는 패는 버립니다",
    body: "필요 없는 패를 골라 버리면 덱에서 같은 수만큼 다시 뽑습니다. 버리기 횟수는 한정되어 있으니 다음 짓과 끗패를 생각하고 사용하세요.",
  },
  {
    id: "collection",
    target: "collection",
    title: "수집판",
    body: "낸 카드와 잡은 카드가 종류별로 쌓입니다. 광·동물·띠·피는 실제 고스톱 방식으로 수집 점수를 냅니다. 장터에서 비결서를 사면 해당 수집 족보의 효과가 더 강해집니다. 한 판이 끝나면 수집판은 비워집니다.",
  },
  {
    id: "collection-choose",
    target: "collection",
    title: "모을 종류를 정하세요",
    body: "손마다 모든 종류를 모을 수는 없습니다. 현재 손패와 수집판을 보고 광·동물·띠·피 가운데 완성 가능성이 높은 쪽을 노리세요. 수집 점수도 목표 점수에 함께 들어갑니다.",
  },
  {
    id: "talisman",
    target: "talisman",
    title: "부적",
    body: "장터에서 산 부적은 위쪽 칸에 놓이며 조건을 만족할 때 자동으로 발동합니다. 빈 점선 칸만큼 더 살 수 있고, 장터에서는 가진 부적을 팔 수도 있습니다.",
  },
  {
    id: "go",
    target: "go",
    title: "고를 외쳐 보세요",
    body: "목표를 넘겼습니다. 스톱하면 지금 판돈을 받고 끝납니다. 고를 외치면 다음 목표가 높아지는 대신 판돈이 커집니다. 남은 제출 안에 새 목표를 못 넘기면 이번 도전은 끝납니다.",
    actionHint: "‘1고’ 누르기",
    when: (state) => state.screen === "decision",
    doneWhen: (state) => state.chain.goCount >= 1 || state.stage >= 2,
  },
  {
    // Fills the gap between calling Go and clearing the new bar. Without this
    // the next step told the player to press 스톱 while they were still playing.
    id: "go-chase",
    target: "go-banner",
    title: "이제 새 문턱을 넘어야 합니다",
    body: "고를 외치면 새 목표까지 다시 점수를 쌓아야 합니다. 화면 위쪽에 부족한 점수가 표시됩니다. 남은 제출 횟수로 넘길 수 있을지 확인하고 고를 선택하세요.",
    actionHint: "문턱까지 계속 제출",
    when: (state) => state.screen === "play" && state.chain.goCount >= 1,
    doneWhen: (state) =>
      state.screen === "decision" || state.screen === "reward" || state.screen === "shop" || state.stage >= 2,
  },
  {
    id: "stop",
    target: "stop",
    title: "이번엔 스톱",
    body: "새 문턱까지 넘겼습니다. 여기서 스톱하면 1.7배로 불어난 판돈을 그대로 받고 판이 끝납니다.",
    actionHint: "‘스톱’ 누르기",
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
    actionHint: "‘보상 받기’ 누르기",
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
    body: "부적은 산 뒤 계속 보유하며 조건을 만족할 때 자동으로 발동합니다. 어떤 부적을 함께 두느냐에 따라 점수 내는 방식이 달라집니다.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "dept-book",
    target: "dept-book",
    title: "비결서점",
    body: "적힌 끗패나 수집 족보의 효과를 한 단계 높입니다. 카드 아래의 현재 효과와 구매 후 효과를 비교한 뒤 고르세요.",
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
    actionHint: "‘첫 부적’ 구매",
    when: (state) => state.screen === "shop",
    doneWhen: (state) => state.talismans.length >= 1 || state.stage >= 2,
  },
  {
    id: "shop-reroll",
    target: "shop-reroll",
    title: "물건이 마음에 안 들면",
    body: "냥을 내면 장터의 물건이 모두 바뀝니다. 같은 장터에서 여러 번 바꿀수록 비용이 오르니 필요한 때만 사용하세요.",
    when: (state) => state.screen === "shop",
  },
  {
    id: "shop-leave",
    target: "shop-leave",
    title: "다음 판으로",
    body: "장터를 떠나면 2월이 시작됩니다. 여기서부터는 안내 없이 직접 판단하게 됩니다.",
    actionHint: "‘다음 판으로’ 누르기",
    when: (state) => state.screen === "shop",
    doneWhen: (state) => state.stage >= 2,
  },
];
