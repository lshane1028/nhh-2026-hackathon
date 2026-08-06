# 꽃판: GO! 개발 인수인계 및 다음 작업 프롬프트

> 이 문서는 다른 코딩 에이전트/프롬프트에 그대로 전달하기 위한 현재 상태의 기준 문서다.  
> 저장소: `C:\Users\ashan\Desktop\hackathon`  
> 기술 스택: React 19, TypeScript, vinext/Vite, Vitest, OpenAI Sites  
> 기존 비공개 사이트: `https://flower-board-go-2026.ashane1028.chatgpt.site/`

## 1. 프로젝트 목표

`꽃판: GO!`는 기본 화투 48장을 사용하는 Balatro 계열의 싱글 플레이 덱빌딩 로그라이크다.

핵심 재미는 다음 네 축이다.

1. 손패에서 1~5장을 직접 골라 `월 합 × 배수` 점수를 만든다.
2. 가능한 족보 중 어떤 족보로 점수를 낼지 플레이어가 직접 고른다.
3. 광·동물·띠·피를 한 판 동안 모아 지속 배수를 성장시킨다.
4. 점수를 안전하게 챙길지, `고`를 선언해 다음 손에 더 큰 문턱을 넘을지 결정한다.

게임 이미지는 아직 만들지 않는다. 현재 모든 카드·화면 이미지 자리는 텍스트와 교체 가능한 `assetTag` 또는 `data-asset-tag`로 유지한다. 사용자가 나중에 제공하는 이미지만 연결한다.

## 2. 반드시 유지할 확정 방향

- 드래그 조작은 사용하지 않는다. 카드는 버튼 클릭으로만 선택/해제한다.
- 화면 점수는 `월 합 × 배수 = 총점`으로 설명한다.
- 과거의 광 20끗·동물 10끗·띠 5끗·피 1끗 같은 끗값 체계를 다시 노출하지 않는다.
- 족보는 항상 자동으로 최고점이 적용된다. 플레이어가 족보를 고르는 UI를 두지 않는다.
- 시작 덱 선택 화면을 두지 않는다. 모든 새 게임은 기본 `deck_standard` 화투 48장으로 시작한다.
- 덱의 개성은 시작 전에 고르는 것이 아니라 스테이지를 깨고 상점·강화·추가·복제·소각으로 만든다.
- 수집판은 광·동물·고도리·띠·피 다섯 줄을 사용한다.
- 광을 삼광·사광·오광의 큰 상자 세 개로 나누지 않는다. 광 한 줄에 슬롯 5개만 둔다.
- 동물 그림이 있는 모든 동물패를 동물 트랙에 포함한다. 고도리는 별도 줄로 표시하되 새 세 장은 동물 트랙에도 함께 집계한다.
- 9월 술잔의 역할은 판 전체에 걸린 전역 설정이 아니다. 점수를 낸 뒤 수집판에 기록할 때 카드마다 한 번 고른다.
- 피는 5부터 성장하고, 10에서 크게 뛰며, 10 이후에도 장당 작은 성장이 계속되어야 한다.
- 별도 로그 패널과 별도 마당패 패널을 메인 화면에 다시 넣지 않는다.
- 카드/배경/아이콘 이미지를 임의로 생성하거나 외부 이미지를 추가하지 않는다.

## 3. 기존에 구현되어 있던 기능

- 1~12월, 월별 4장으로 구성된 기본 화투 48장 데이터
- 광·동물·띠·피·쌍피, 9월 술잔 역할 전환
- 8장 손패, 기본 제출 4회, 기본 버리기 4회
- 클릭 기반 1~5장 선택과 덱 순환
- 즉시 족보 후보 판정과 족보 레벨/숙련
- 상점, 부적, 비결서, 화공 카드, 금단 계약
- 영구 월 변경·종류 변경·강화·판본·낙관 등 카드 개조
- 12개 스테이지, 날씨, 두목, 보상, 저장/이어하기
- 고·스톱 점수 항아리, 미확정 수집, 고 실패 롤백
- 첫 플레이 튜토리얼과 첫 상점 추천 안내의 기본 구조
- 텍스트 프로토타입용 `assetTag` 체계
- `npm run verify` 테스트·타입 검사·ESLint·프로덕션 빌드 파이프라인

내부 타입과 엔진에는 이전 구현 호환을 위해 `kkeut`, `heung`, `startingKkeut`, `finalKkeut` 같은 이름이 남아 있다. 사용자 화면에서는 각각 월 합과 배수로만 표현한다.

## 4. 이번 작업에서 변경한 내용

### 4.1 카드 선택 혼동 수정

사용자가 세 번째 카드를 눌렀을 때 엉뚱한 카드가 선택된 것처럼 보인 원인은 reducer의 교차 해제가 아니었다.

- 실제 선택 배열 `selectedCardIds`는 클릭한 `instanceId`만 토글한다.
- 기존 자동 최고점 preview가 매 클릭마다 다른 `scoringCardIds`를 골랐다.
- 금색 득점 테두리가 빨간 선택 테두리를 CSS 순서상 덮어서 선택이 옮겨간 것처럼 보였다.

현재 수정 방향:

- 카드 선택이 바뀌면 `manualYakuId`를 초기화한다.
- 9월 술잔 역할이 바뀌어도 `manualYakuId`를 초기화한다.
- 족보를 고르기 전에는 preview와 득점 카드 강조를 만들지 않는다.
- 선택+득점 상태가 겹치면 빨간 선택 외곽을 유지하고 금색은 안쪽 광택으로만 표시한다.
- 카드 하단 문구도 `선택됨 · 점수 포함`처럼 두 상태를 함께 표시한다.

관련 파일:

- `game/state/game.ts`
- `app/GameApp.tsx`
- `app/components/HwatuCard.tsx`
- `app/components/game-ui.css`
- `game/tests/state.test.ts`

### 4.2 최고점 자동 제거와 수동 족보 제출

- `최고점 자동` 버튼과 자동 선택 안내를 제거했다.
- 선택 카드로 가능한 족보 버튼만 표시한다.
- 족보 버튼에는 이름, 기본 배수, 짧은 조건을 표시한다.
- `manualYakuId`가 없으면 예상 점수를 표시하지 않고 제출 버튼을 잠근다.
- reducer도 수동 족보가 없는 제출을 거부한다.
- 선택한 족보가 현재 조합에서 무효이면 다른 족보로 자동 fallback하지 않는다.

주의: 같은 족보 안에 가능한 카드 부분집합이 여러 개일 때는 현재 그 족보 내부의 최고 부분집합을 엔진이 고른다. 추후 완전 수동화를 원하면 `manualYakuId`만 저장하지 말고 `yakuId + scoringCardIds` 후보 키를 UI에 노출해야 한다.

### 4.3 수집판을 네 개 트랙으로 단순화

기존 홍단·초단·청단·고도리·비삼광·삼광·사광·오광의 개별 큰 카드를 없애고 다음 네 줄로 합쳤다.

| 트랙 | 표시 | 지속 효과 |
|---|---|---|
| 광 | 어두운 원형 슬롯 정확히 5개, 수집 슬롯만 금빛 | 3장 `배수 +2`, 4장 `+4`, 5장 `+7` |
| 동물 | 모든 동물 그림패 누적 슬롯 | 5장 `배수 +2`, 이후 한 장당 `+0.5`, 고도리 `+2` |
| 띠 | 모든 띠 누적 슬롯 | 5장 `배수 +2`, 이후 한 장당 `+0.5`, 홍단·초단·청단 각각 `+2` |
| 피 | 피값 기준 슬롯 10개, 초과 `+N` | 5피 `배수 +1`, 6~9피 장당 `+0.25`, 10피 `+4`, 11피부터 초과 피마다 `월 합 +1` |

쌍피는 피 슬롯 두 칸으로 계산한다. 9월 술잔을 피로 사용할 때도 피 2로 계산한다.

관련 파일:

- `app/components/CollectionBoard.tsx`
- `app/components/game-ui.css`
- `game/engine/collection-bonus.ts`
- `game/tests/collection-bonus.test.ts`
- `app/GameApp.tsx`

### 4.4 지속 수집 보너스 엔진

`calculateCollectionBonus(cards, cupRole)` 순수 함수를 추가했다.

반환값:

```ts
{
  counts: { bright, animal, ribbon, chaff },
  completedSets: { godori, hongdan, chodan, cheongdan },
  multiplierBonus,
  monthSumBonus,
  effects,
  milestones
}
```

중복 `instanceId`, 이번 판 사용 불가 카드, 돌패, 와일드, 임시 광 취급, 9월 술잔 역할을 고려한다. 라이브 게임은 확정 수집 + 고에 걸린 미확정 수집 + 이번 제출/획득 카드를 합쳐 매 제출에 지속 효과를 계산한다.

기존 `newCollectionYakuIds`의 일회성 완료 배수와 새 지속 효과가 이중 적용되지 않도록 라이브 게임에서는 `applyCollectionCompletionBonus: false`를 전달한다. 완료 ID 자체는 수집 이정표·숙련·고 실패 롤백을 위해 유지한다.

### 4.5 시작 덱 선택 제거

- `TitleScreen`에서 시작 덱 10종 카드 목록과 선택 props를 제거했다.
- `GameApp`의 `selectedDeckId` 상태와 `START_DECKS` UI 전달을 제거했다.
- `새 게임`은 항상 `deck_standard`로 시작한다.
- 게임 종료 후 재시작도 항상 `deck_standard`를 사용한다.
- 시작 화면에는 선택 UI 대신 `기본 화투 48장`이라는 고정 구성만 짧게 보여 준다.

`game/content/meta.ts`의 과거 시작 덱 정의와 `GameState.startDeckId`는 저장 데이터/엔진 호환을 위해 아직 남아 있다. UI에서는 접근할 수 없다. 완전히 삭제하려면 저장 마이그레이션까지 함께 설계한다.

### 4.6 첫 판 튜토리얼 수정

첫 판 안내를 5단계로 정리했다.

1. 카드를 클릭한다.
2. 한 장을 더 골라 조합을 만든다.
3. 가능한 족보 중 하나를 직접 고른다.
4. `월 합 × 배수`를 확인하고 제출한다.
5. 점수를 저장할지 고를 외칠지 선택한다.

규칙 모달도 자동 최고점 없이 직접 족보를 고르는 흐름과 네 수집 트랙을 설명하도록 변경했다.

### 4.7 자동 최고점 복귀와 술잔 기록 시점 변경 (2026-08-06)

4.2에서 도입한 수동 족보 선택을 되돌렸다. 사용자 결정이며, 위의 확정 방향과 금지사항도 함께 갱신했다.

- `manualYakuId` 상태와 `SET_MANUAL_YAKU`·`SET_CUP_ROLE` 액션을 제거했다.
- `evaluateSelectedHand`가 모든 후보를 평가해 `chooseDefaultCandidate`로 최고점을 고른다.
- 손패 아래 족보 버튼은 읽기 전용 표시(`.yaku-readout`)로 바뀌었다. 함께 성립한 다른 족보는 회색 배지로만 보여 준다.
- 수집판은 고도리를 2·4·8월 라벨이 붙은 3칸 전용 줄로 분리했다. 새 세 장은 동물 줄에도 그대로 집계되므로 배수 계산은 이전과 동일하다.
- 9월 술잔의 전역 토글을 없앴다. `cupAssignments: Record<instanceId, CupRole>`와 `pendingCupCardId`가 이를 대신한다.
- 술잔이 포함된 제출은 동물/쌍피 두 역할을 모두 평가해 점수가 높은 쪽으로 계산한다. 제출 후 `CupChoiceModal`이 열려 수집판에 어디로 기록할지 묻는다.
- 따라서 이번 손의 점수와 수집판 기록이 서로 다른 역할을 쓸 수 있다. 의도된 동작이며 모달 문구로 안내한다.

관련 파일:

- `game/types.ts`, `game/state/actions.ts`, `game/state/game.ts`, `game/state/storage.ts`
- `game/engine/deck.ts` (`CupRoleSource`, `resolveCupRole`, `isCupCard`)
- `game/engine/collection-bonus.ts` (`counts.godori`, `matchedGodoriMonths`, 인스턴스별 술잔 역할)
- `app/GameApp.tsx`, `app/components/CollectionBoard.tsx`, `app/game.css`, `app/components/game-ui.css`
- `game/tests/state.test.ts`, `game/tests/collection-bonus.test.ts`

### 4.8 UI 전면 개편 — 고정 뷰포트 3열 셸 (2026-08-06)

플레이 화면과 장터 화면이 같은 셸을 쓴다. 스크롤 없이 한 화면에 들어오는 것이 목표다.

```text
.play-shell  (height: 100dvh, overflow: hidden)
├─ .play-rail    좌측 정보 레일 — 목표, 누적 점수 게이지, 월합 × 배수, 자원 4칸, 메뉴
├─ .play-board   중앙 — 부적 스트립, 손패(부채꼴), 덱 스택, 액션 행
└─ .play-side    우측 — 수집판 5줄
```

- 좌측 레일은 장터에서도 그대로 남는다. `PlayRail`의 `banner` prop이 있으면 스테이지 판 대신 상점 간판이 들어간다.
- 손패는 `<li>`에 `--i`/`--n`을 넘기고 CSS `cos()`로 회전·아치를 계산한다. 카드 자체 transform은 건드리지 않아 선택·호버 효과가 그대로 겹친다.
- 카드는 `dense` 얼굴을 쓴다. `#pine` 같은 태그 목록은 `title` 툴팁으로 내렸다.
- 장터는 `.market-panel`의 액션 열 + 랙 구조다. 가격은 카드 위에 떠 있는 금색 알약(`.market-card__price`)으로 표시한다.
- 1080px 미만 또는 높이 620px 미만에서는 3열을 포기하고 세로 스크롤 단일 열로 전환한다.

**이미지 슬롯.** 그림이 들어갈 자리는 전부 전용 요소로 분리했고 `IMG` 배지와 태그가 보인다. 마크업 수정 없이 CSS 한 줄로 교체한다. 자세한 절차는 `docs/ASSET_REPLACEMENT_GUIDE.md` 참고.

| 슬롯 | 선택자 |
|---|---|
| 화투패 | `.hwatu-card__art[data-asset-tag]` |
| 카드 뒷면 | `.deck-stack__back[data-asset-tag]` |
| 스테이지 판 | `.play-rail__stage-plate[data-asset-tag]` |
| 상점 간판 | `.play-rail__banner[data-asset-tag]` |
| 상품·계약·보상 | `.market-art[data-asset-tag]` |

삭제한 컴포넌트: `GameTopBar`(→ `PlayRail`로 흡수), `ScoreFormula`(→ 레일 점수식으로 흡수). 죽은 CSS도 함께 제거했다.

### 4.9 고 시스템 재설계 · 카드/상점/부적 UI (2026-08-06)

**고는 판마다 한 번 거는 베팅이 됐다.** 손을 낼 때마다 묻던 방식을 버렸다.

- 제출한 점수는 `chain.roundScore`에 계속 누적된다. 중간에 정산하거나 되돌리는 단계가 없다.
- 현재 문턱(`getRoundRequirement`)을 넘긴 순간에만 `decision` 화면이 열린다.
- 스톱하면 판돈을 받고 판이 끝난다. 고를 외치면 문턱과 판돈이 함께 올라간다.

| 고 | 문턱 (목표 대비) | 판돈 배수 |
|---|---|---|
| 0 | 100% | ×1 |
| 1 | 150% | ×1.5 |
| 2 | 220% | ×2.25 |
| 3 | 320% | ×3.4 |

- **고를 외치고 남은 제출로 문턱을 못 넘기면 런이 끝난다.** `fail_rescue` 부적만 고 한 단계를 물러 준다.
- 되돌릴 일이 없어졌으므로 `GoChainState`의 확정/미확정 수집 분리를 없앴다. 이제 `collection` 하나뿐이다.
- `BANK_CHAIN` 액션과 `resolveGoAttempt`·`armGo`·`settleChainAtomically` 계열을 전부 제거했다. 새 API는 `addHandToRound`·`declareGo`·`getGoRequirement`·`getGoRewardFactor`·`settleRound`다.
- 두목 규칙 조정: `requires_go`는 고를 외치기 전 스톱을 막고, `go_fail_tax`는 고 문턱을 10% 더 올린다(기존 "확정 점수 10% 감소"는 되돌릴 점수가 없어져 의미를 잃었다).

**카드는 그림이 전부다.** 앞면에는 좌상단 월 숫자만 남겼다. 월값·종류·띠 라벨·태그는 전부 호버 카드(`.hwatu-card__hint`)로 내렸다. 손패 여덟 장이 여덟 개의 그림으로 읽힌다.

**상점은 레일을 걷어냈다.** `.market-shell`은 좌우 레일 없이 배너 + 패널만 쓴다. 점수판과 수집판은 판을 진행할 때만 의미가 있어서 장터에서는 보여 주지 않는다.

**부적 칸.** 빈 칸은 점선 사각형만 남기고 문구를 없앴다. 보유한 부적은 호버하면 이름·등급·효과가 뜬다.

### 4.10 스포트라이트 튜토리얼과 단일 화면 장터 (2026-08-06)

**장터의 이중 진입을 없앴다.** `shop_choice` 화면과 `CHOOSE_SHOP` 액션을 제거했다. 보상 뒤에는 바로 `shop`으로 가고, 부적·화공·비결서·금단 네 종류가 한 줄에 한 장씩 놓인다. 꾸러미는 아래 점선 랙에 따로 둔다. 꾸러미를 사면 화면을 갈아타지 않고 같은 랙이 무료 후보 3장으로 바뀐다.

- `generateShopOffers()`가 카테고리마다 한 장씩 뽑는다. 기존 `generateOffers()`는 꾸러미 개봉 전용으로 남았다.
- 리롤은 장터 전체를 다시 뽑는다. 꾸러미 개봉 중에는 그 후보만 다시 뽑는다.

**튜토리얼은 스포트라이트 방식이다.** 상단 안내 패널(`TutorialCoach`)을 버리고 화면을 어둡게 덮은 뒤 한 요소만 뚫어서 보여 준다.

- `TutorialSpotlight`가 `data-tutorial` 속성으로 대상을 찾아 `getBoundingClientRect()`로 구멍을 낸다. 구멍은 별도 오버레이가 아니라 `box-shadow: 0 0 0 9999px`의 바깥 그림자라서 한 요소로 끝난다.
- 대상에는 `.tutorial-target`이 붙어 `z-index`가 어둠 위로 올라간다. **그래서 그 요소만 눌린다.**
- 대본은 `app/components/tutorial-steps.ts`에 있다. 1월에서만 돈다.
- `doneWhen`이 있는 단계는 다음 버튼 없이 플레이어가 실제로 해야 넘어간다. `when`이 거짓이면 건너뛴다.
- **판정은 단조(monotonic)여야 한다.** 예를 들어 손패 단계는 `selectedCardIds.length >= 2 || roundSubmissionIndex >= 1`이다. 제출 후 선택이 비면 끝난 단계가 되살아나기 때문이다. 이 규칙 덕분에 진행 상태를 따로 저장하지 않고 순수 계산으로 현재 단계를 구한다.
- 다루는 내용: 목표 → 손패 선택 → 월 합 × 배수 → 제출 → 버리기 → 흔들기 → 수집판 → 부적 → 고 → 스톱 → 보상 → 장터 → 첫 구매 → 다음 판.

**첫 부적.** 튜토리얼 장터는 항상 `t_first_charm`("어떤 족보로 내든 배수 +4")을 내놓는다. 효과가 조건 없이 읽히는 유일한 부적이라 첫 구매용으로 넣었다. 이를 위해 `yaku_add_heung`이 `yakuIds` 없이 쓰이면 무조건 발동하도록 고쳤다.

## 5. 현재 핵심 파일 구조

```text
app/GameApp.tsx
  전체 화면 조합, 수동 족보 UI, 튜토리얼, reducer 연결

app/game.css
  플레이 테이블, 족보 버튼, 반응형 레이아웃

app/components/HwatuCard.tsx
  카드 클릭, aria-pressed, selected/scoring 상태

app/components/CollectionBoard.tsx
  광·동물·띠·피 네 개 누적 트랙

app/components/ScoreFormula.tsx
  월 합 × 배수 표시

app/components/TitleScreen.tsx
  기본 48장 고정 시작 화면

app/components/TutorialCoach.tsx
  첫 판 단계별 안내

app/components/MarketScreen.tsx
  상점 선택·구매·첫 상점 안내

app/components/TalismanStrip.tsx
  부적 보유 슬롯

app/components/game-ui.css
  카드·점수·수집판·부적 UI

game/content/cards.ts
  기본 화투 48장 정의

game/content/yaku.ts
  즉시 족보 및 기존 수집 완료 ID 정의

game/engine/yaku.ts
  가능한 즉시 족보 후보와 수집 완료 판정

game/engine/scoring.ts
  월 합 × 배수 계산 및 연산 순서

game/engine/collection-bonus.ts
  광·동물·띠·피 지속 수집 효과

game/engine/go.ts
  고 문턱, 점수 항아리, 확정/미확정/실패 롤백

game/state/game.ts
  선택·제출·고·상점·스테이지 상태 전이

game/tests/state.test.ts
  선택과 수동 제출 회귀 테스트

game/tests/collection-bonus.test.ts
  수집 임계값 테스트

assets/manifest.json
  향후 사용자 이미지 연결용 assetTag 목록

.openai/hosting.json
  기존 Sites 프로젝트 연결
```

## 6. 다음 개발자가 해야 할 일

### P0. 현재 변경 검증 및 오류 수정

- `npm run verify`를 실행해 테스트·타입 검사·ESLint·프로덕션 빌드를 모두 통과시킨다.
- 타입 오류가 있으면 수집판 새 props와 `GameApp` 매핑부터 확인한다.
- 카드 선택 테스트에서 1·3·5번째 카드의 `instanceId`가 정확히 유지되는지 확인한다.
- 수동 족보 없는 제출, 무효 수동 족보 fallback 금지, 술잔 역할 변경 초기화를 확인한다.
- 피 4/5/9/10/11 경계와 광 2/3/4/5 경계를 확인한다.

### P0. 실제 브라우저 상호작용 QA

- 시작 화면에 시작 덱 선택 카드가 전혀 없는지 확인한다.
- 서로 떨어진 카드 세 장을 눌러 `aria-pressed="true"`와 `data-card-id`가 정확히 세 개인지 검사한다.
- 족보 선택 전 점수 preview가 비어 있고 제출 버튼이 비활성화되는지 확인한다.
- 족보를 고른 뒤에만 점수와 득점 카드가 나타나는지 확인한다.
- 카드를 추가하거나 해제하면 족보 선택과 preview가 초기화되는지 확인한다.
- 수집판이 광·동물·띠·피 네 줄만 렌더링하는지 확인한다.
- 데스크톱과 모바일 폭에서 가로 스크롤, 카드 겹침, 잘린 버튼이 없는지 확인한다.
- 콘솔 오류가 없는지 확인한다.

### P1. 밸런스 플레이테스트

- 현재 수집 보너스는 잠정 수치다. 초반 1~3스테이지에서 수집 효과가 너무 늦지 않은지 확인한다.
- 광 5장의 `+7배수`, 피 10의 `+4배수`, 단 세트 중첩이 함께 터질 때 목표 점수가 무너지는지 시뮬레이션한다.
- 고 1/2/3단계 문턱이 수집 성장 속도와 맞는지 확인한다.
- 결과를 `docs/BALANCE_REPORT.md`에 표로 기록한다.

### P1. 튜토리얼과 상점 안내 다듬기

- 첫 판 튜토리얼의 강조 대상이 실제 버튼 위치와 일치하는지 확인한다.
- 첫 상점 진입 시 `이 상점은 무엇인지 → 상품은 무엇을 바꾸는지 → 추천 상품 하나를 사보기` 순서가 보이는지 확인한다.
- 설명은 한 번에 한 행동만 요구하도록 짧게 유지한다.

### P1. 문서와 레거시 정리

- `README.md`, `01_GAME_DESIGN_PLAN.md`, `02_MASTER_BUILD_PROMPT.md`, `docs/BALANCE_REPORT.md`에 남은 시작 덱 선택·자동 최고점·끗값 설명을 현재 규칙과 맞춘다.
- `TitleScreen`의 사용하지 않는 시작 덱 CSS를 정리한다.
- `OPEN_DECK_SELECT`, `deck_select`, `START_DECKS` 데이터의 완전 제거 여부는 저장 호환 정책을 정한 뒤 처리한다.
- `assetTag`는 삭제하지 않는다.

### P2. 카드 이미지 연결

- 사용자가 실제 카드 이미지를 제공한 뒤에만 진행한다.
- `assets/manifest.json`과 각 카드의 `assetTag`를 기준으로 이미지를 매핑한다.
- 강화·판본·낙관 효과는 작은 아이콘만 붙이는 방식이 아니라 카드 전체 표면에 CSS 레이어로 적용한다.
- 이미지가 없어도 게임 기능과 접근성이 그대로 동작해야 한다.

## 7. 완료 조건 체크리스트

- [ ] 시작 화면에 시작 덱 선택 UI가 없다.
- [ ] 새 게임과 재시작은 항상 기본 화투 48장으로 시작한다.
- [ ] 첫 번째·세 번째·다섯 번째 카드를 누르면 정확히 그 세 카드만 선택된다.
- [ ] 선택 카드 하나를 다시 누르면 그 카드 하나만 해제된다.
- [ ] 5장 선택 후 여섯 번째 카드를 눌러도 기존 5장이 임의로 바뀌지 않는다.
- [ ] 카드를 고르는 즉시 최고점 족보와 `월 합 × 배수`가 표시된다.
- [ ] 화면에 족보를 고르는 버튼이 없다.
- [ ] 수집판에는 광·동물·고도리·띠·피 다섯 줄이 있다.
- [ ] 광은 정확히 5개 슬롯이며 별도 삼광·사광·오광 상자가 없다.
- [ ] 고도리 줄은 2·4·8월 라벨이 붙은 3칸이며 보유한 달만 켜진다.
- [ ] 모든 동물패가 동물 트랙에 집계되고 새 세 장도 동물에 포함된다.
- [ ] 손패 아래에 9월 술잔 역할 토글이 없다.
- [ ] 술잔으로 점수를 낸 직후 기록 위치를 묻는 모달이 뜨고, 같은 카드는 다시 묻지 않는다.
- [ ] 피 5/10/10초과 성장 규칙이 점수에 실제 적용된다.
- [ ] 튜토리얼과 상점 안내가 실제 조작 순서와 일치한다.
- [ ] 로그·마당패 패널이 메인 화면에 없다.
- [ ] `npm run verify`가 통과한다.
- [ ] 브라우저 콘솔 오류와 가로 스크롤이 없다.
- [ ] 검증된 정확한 소스만 기존 비공개 Sites 프로젝트에 배포한다.

## 8. 금지사항

- 이미지 생성 금지
- 사용자 제공 전 외부 카드 이미지 추가 금지
- 드래그앤드롭 재도입 금지
- 수동 족보 선택 UI 재도입 금지
- 끗값 점수 체계 재도입 금지
- 광 수집을 별도 삼광·사광·오광 카드로 분리 금지
- 동물 수집을 고도리 세 장만으로 축소 금지
- 9월 술잔의 전역 역할 토글 재도입 금지
- 피 10 이후 성장 중단 금지
- 로그/마당패 메인 패널 재도입 금지
- 기존 `.openai/hosting.json`과 Sites 연결 교체 금지
- 공개 사이트로 전환 금지
- 검증 전 커밋/배포 금지
- `git reset --hard`, `git checkout --` 등으로 사용자 작업 삭제 금지

## 9. 검증 명령

```powershell
npm install
npm run test
npm run typecheck
npm run lint
npm run build
npm run verify
```

개발 서버:

```powershell
npm run dev -- --port 3101
```

최종 배포는 `npm run verify`와 인앱 브라우저 QA가 모두 끝난 커밋을 기존 OpenAI Sites 프로젝트의 새 비공개 버전으로 저장하고 배포한다.

## 10. 이 인수인계 시점의 검증 상태

- Git 기준 소스 복구 후 이번 변경을 다시 적용했다.
- `npm install`을 완료해 `node_modules`를 복구했다.
- `git diff --check`는 통과했다.
- 금지 문구 검색 결과 `app`과 라이브 게임 UI에는 `최고점 자동` 및 `시작 덱 선택`이 남아 있지 않다.
- `npm run verify`는 코드 오류가 아니라 현재 Codex 실행 한도 승인 차단으로 실행되지 못했다. 다음 작업자는 가장 먼저 이 명령을 실행해야 한다.
- 설치 직후 `npm audit` 요약은 16건(낮음 2, 높음 13, 치명적 1)을 보고했다. 무작정 `npm audit fix --force`를 실행하지 말고, 실제 의존 경로·업데이트 호환성·Sites 빌드를 확인한 뒤 별도 보안 업데이트로 처리한다.
- 이 시점의 변경은 아직 커밋하거나 배포하지 않았다.
