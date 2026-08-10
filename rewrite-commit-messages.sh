#!/usr/bin/env bash
#
# 커밋 메시지 일괄 재작성 스크립트 — nhh-2026-hackathon
#
#   사용법:  bash rewrite-commit-messages.sh
#
# 원본 커밋 SHA를 기준으로 메시지만 바꿉니다. 파일 내용·작성자·날짜는 건드리지 않습니다.
# 실행 전 백업 태그를 만들고, 끝나면 검증 결과를 출력합니다.
#
# ⚠ 히스토리가 다시 쓰이므로 force push가 필요하고,
#    공동 작업자는 반드시 다시 클론해야 합니다.

set -euo pipefail

# ── 0. 사전 점검 ────────────────────────────────────────────────
if [ -n "$(git status --porcelain --untracked-files=no | grep -v '^ M ' || true)" ]; then
  echo "⚠ 스테이징된 변경이 남아 있습니다. 커밋하거나 되돌린 뒤 다시 실행하세요."
  git status --short
  exit 1
fi

BACKUP="backup/before-message-rewrite-$(date +%Y%m%d-%H%M%S)"
git tag "$BACKUP" HEAD
echo "✔ 백업 태그 생성: $BACKUP"
echo "  (문제가 생기면  git reset --hard $BACKUP  으로 되돌릴 수 있습니다)"
echo

# ── 1. 메시지 매핑 ──────────────────────────────────────────────
# $GIT_COMMIT 은 재작성 전 원본 SHA 입니다.
export FILTER_BRANCH_SQUELCH_WARNING=1

git filter-branch -f --msg-filter '
case "$GIT_COMMIT" in

  # ── 초기 셋업 ──────────────────────────────────────────────
  00623da7*)  echo "docs: update README" ;;

  5adeef7*)
    echo "feat: scaffold playable web prototype"
    echo
    echo "규칙 엔진 · 콘텐츠 카탈로그 · 런 상태 · UI를 각각 독립 모듈로 분리해"
    echo "브라우저에서 실행 가능한 프로토타입을 구성한다."
    ;;

  # ── 수집판 · 런 상태 ───────────────────────────────────────
  5b337ef*)
    echo "feat: add collection board and rework title screen"
    echo
    echo "수집판 컴포넌트를 추가하고 제목 화면을 정리한다."
    echo "런 상태 전이 테스트를 함께 넣는다."
    ;;

  # ── 고·스톱 엔진 재작업 ────────────────────────────────────
  e62c3d5*)
    echo "refactor: rework go/stop threshold engine and run state machine"
    echo
    echo "고 문턱 계산을 engine/go.ts로 모으고 런 리듀서를 재구성한다."
    echo "덱·부적·저장 경로를 새 상태 구조에 맞춘다."
    ;;

  7012adf*)
    echo "fix: correct talisman, experimental rule and go threshold behaviour"
    echo
    echo "부적 발동 조건과 실험 규칙 토글, 고 문턱 계산의 경계값을 바로잡는다."
    echo "회귀를 막는 상태 전이 테스트를 추가한다."
    ;;

  # ── 짓고땡 전환 (파괴적 변경) ──────────────────────────────
  4b35fc0*)
    echo "feat!: replace poker-style yaku with 짓고땡 rules"
    echo
    echo "포커식 즉시 족보 17종을 전통 화투 놀이 짓고땡 기반 규칙으로 교체한다."
    echo "제출한 패는 짓(월 합)과 끗패(섯다 족보 2장)로 갈리고,"
    echo "원래 5장 고정인 규칙을 2~5장 자유 제출로 일반화한다."
    echo
    echo "BREAKING CHANGE: 기존 세이브의 족보 id가 더 이상 해석되지 않는다."
    echo "저장 키를 flower-board-go:v2로 올려 옛 세이브를 폐기한다."
    ;;

  # ── 아트 파이프라인 ────────────────────────────────────────
  74656db*)
    echo "feat(assets): add generated hwatu atlas"
    echo
    echo "도트 화풍으로 생성한 화투 48장 아틀라스를 넣고 생성 프롬프트를 기록한다."
    ;;

  ff9e5e6*)
    echo "feat: render collection board from deck and add tutorial"
    echo
    echo "수집판을 덱에서 만들어 실제 카드 그림으로 그리고,"
    echo "스포트라이트 튜토리얼을 추가한다."
    echo "화면과 채점기가 같은 카드를 세는지 검증하는 테스트를 넣는다."
    ;;

  bc8425c*)
    echo "feat(assets): slice hwatu atlas into per-card art"
    echo
    echo "생성 아틀라스의 칸 경계가 불규칙해 CSS 스프라이트로 쓰면 카드가 잘린다."
    echo "48개 영역을 검출해 최근접 이웃 샘플링으로 160x240 격자에 맞추는"
    echo "결정론적 보정 스크립트를 추가하고, 개별 카드 자산을 생성한다."
    ;;

  # ── 카드 연출 ──────────────────────────────────────────────
  826e630*)
    echo "feat(ui): separate card material and surface channels"
    echo
    echo "각인을 재질로, 판본을 표면으로 분리해 서로 덮어쓰지 않게 한다."
    echo "표식은 12x12 도트 SVG로 그려 카드 그림과 같은 결을 맞춘다."
    echo "모든 효과 태그 쌍이 서로 다른 스프라이트·색 조합인지 테스트로 잠근다."
    ;;

  # ── 금단패 · 장터 ──────────────────────────────────────────
  a99d90d*)
    echo "feat: add forbidden cards and market UI"
    echo
    echo "대가를 치르고 덱을 개조하는 금단패와 장터 화면을 추가한다."
    echo "비용·대상 검증과 상점 제안 구성을 테스트로 덮는다."
    ;;

  # ── 병합 커밋: 첫 줄은 GitHub 관례를 유지하고 설명만 덧붙인다 ──
  fb18d4d*)
    echo "Merge pull request #1 from lshane1028/card_rule"
    echo
    echo "웹 프로토타입 초기 구성"
    ;;
  ff443c9*)
    echo "Merge pull request #2 from lshane1028/card_rule"
    echo
    echo "수집판 추가와 런 상태 테스트 보강"
    ;;
  e9f9573*)
    echo "Merge pull request #3 from lshane1028/card_rule"
    echo
    echo "고·스톱 문턱 엔진과 런 상태 머신 재작업"
    ;;
  cd3711a*)
    echo "Merge pull request #4 from lshane1028/card_rule"
    echo
    echo "부적·실험 규칙·고 문턱 경계값 수정"
    ;;
  ea1fc68*)
    echo "Merge pull request #5 from lshane1028/card_rule"
    echo
    echo "짓고땡 규칙 체계로 전환"
    ;;
  f8e02e4*)
    echo "Merge pull request #6 from lshane1028/card_rule"
    echo
    echo "수집판 렌더링과 튜토리얼"
    ;;
  3b8ac4c*)
    echo "Merge pull request #7 from lshane1028/card_rule"
    echo
    echo "카드별 화투 아트 파이프라인"
    ;;
  f9c3f2c*)
    echo "Merge pull request #8 from lshane1028/card_rule"
    echo
    echo "카드 연출 채널 분리"
    ;;
  105fd9f*)
    echo "Merge pull request #9 from lshane1028/card_rule"
    echo
    echo "금단패와 장터 UI"
    ;;

  # ── 그 외(이미 적절한 메시지)는 원문 유지 ──────────────────
  *) cat ;;
esac
' -- --all

echo
echo "════════════════════════════════════════════════"
echo " 재작성 완료. 결과 확인:"
echo "════════════════════════════════════════════════"
git log --oneline --graph -30

echo
echo "── 검증 ──────────────────────────────────────────"
if git log --format='%s' --branches | grep -qiE '^(asdf|dd|addadsf|update$|create prototype|updated cards image|Update README\.md|fix : |feature : )'; then
  echo "✘ 아직 정리되지 않은 메시지가 있습니다:"
  git log --format='%h %s' --branches | grep -iE '(asdf|^[0-9a-f]+ dd$|addadsf|update$|create prototype|updated cards image|Update README\.md|fix : |feature : )'
else
  echo "✔ 정리되지 않은 메시지 없음"
fi

# 파일 내용이 그대로인지 확인 — 메시지만 바뀌었어야 한다
if [ "$(git rev-parse HEAD^{tree})" = "$(git rev-parse "$BACKUP^{tree}")" ]; then
  echo "✔ 파일 내용 동일 (메시지만 변경됨)"
else
  echo "✘ 파일 내용이 달라졌습니다. git reset --hard $BACKUP 으로 되돌리세요."
  exit 1
fi

cat <<EOF

════════════════════════════════════════════════
 다음 단계
════════════════════════════════════════════════

 1) 위 로그를 눈으로 확인

 2) 원격에 반영 (force push):

      git push --force-with-lease origin main card_rule

 3) 되돌리려면:

      git reset --hard $BACKUP

 4) 결과가 만족스러우면 백업 정리 (선택):

      git update-ref -d \$(git for-each-ref --format='%(refname)' refs/original | tr '\n' ' ')
      git reflog expire --expire=now --all && git gc --prune=now --aggressive

⚠ 공동 작업자(itsfrankocean)는 force push 후 기존 클론을 버리고
   다시 클론해야 합니다. 미리 알려 주세요.

⚠ GitHub의 병합된 브랜치(images, fixing_imgs, fixing_rule)는
   이미 main에 반영되어 있으므로 GitHub에서 삭제하는 편이 깔끔합니다.
EOF
