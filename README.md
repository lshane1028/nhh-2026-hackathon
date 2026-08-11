<div align="center">

# 경화수월

**화투패를 짓과 끗패로 나눠 점수를 만들고,<br>수집 족보와 부적으로 열두 달을 돌파하는 싱글 플레이 덱빌더.**

<img src="public/assets/cards/hwatu/card-01-bright-crane.webp" width="88">
<img src="public/assets/cards/hwatu/card-03-bright-curtain.webp" width="88">
<img src="public/assets/cards/hwatu/card-08-bright-moon.webp" width="88">
<img src="public/assets/cards/hwatu/card-11-bright-phoenix.webp" width="88">
<img src="public/assets/cards/hwatu/card-12-bright-rain.webp" width="88">

<br>

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Tests](https://img.shields.io/badge/tests-240%20passing-2f5c46)
![Runtime AI](https://img.shields.io/badge/runtime%20AI-none-b02f28)

**NAN 2026 · NHN Game × AI Hackathon**

</div>

---

## 🎮 플레이

| | |
|---|---|
| **웹에서 바로 플레이** | **[경화수월 실행하기](https://lshane1028.github.io/nhh-2026-hackathon/)** |
| **플레이 영상** | _(업로드 예정)_ |

> 설치 · 회원가입 · API 키가 필요 없습니다. 링크를 열면 브라우저에서 바로 실행됩니다.

<br>

## 📖 이 게임은

포커 족보를 화투 그림으로 갈아 끼운 카드 게임이 **아닙니다.** 제출 규칙을 실제로 화투로 하는 놀이에서 가져왔습니다.

**짓고땡**은 낸 패를 두 덩어리로 나눠 읽습니다.

- **짓** — 월(月)의 합을 맞추는 쪽. 합이 10의 배수여야 제출이 성립합니다.
- **끗패** — 섯다 족보로 겨루는 쪽. 두 장의 월 합 끝자리가 끗수입니다.

이 구조가 그대로 점수식이 됩니다.

```
점수 = floor( 월 합 × 배수 )
         └ 짓        └ 끗패
```

**카드를 고르는 순서가 곧 규칙입니다.** 먼저 고른 두 장이 끗패, 나머지가 짓이 됩니다.
같은 다섯 장이라도 어느 두 장을 먼저 집느냐에 따라 점수가 완전히 달라집니다.

여기에 더해, 한 판 동안 모은 카드의 **전통 고스톱 점수**가 제출 점수와 별개로 합산됩니다.

```
라운드 점수 = 제출 점수 합계 + ( 고스톱 점수 × 20 )
                                 └ 광 · 열끗 · 고도리 · 띠 · 단 · 피
```

<br>

### 한 판의 흐름

```
 손패 8장 ──▶ 2~5장 선택 ──▶ 짓 / 끗패로 갈림 ──▶ 점수 가산
    ▲              ▲                                  │
    │              └──────── 아니오 ◀───────┐         ▼
    │                                    ┌──────────────┐
    │                                    │  목표 돌파?  │
    │                                    └──────────────┘
    │                                      │          │
    │                            ┌─────────┘          └─────────┐
    │                            ▼                              ▼
    │                        ┌────────┐                    ┌─────────┐
    │                        │  스톱  │                    │   고    │  최대 3회
    │                        └────────┘                    └─────────┘
    │                            │                              │
    │                            ▼                    문턱 실패 ▼
    │                     ┌─────────────┐              ┌──────────────┐
    └─────────────────────│ 장터 → 다음 달│              │ 고박 · 런 종료 │
                          └─────────────┘              └──────────────┘
```

- 한 판은 **손패 8장 · 제출 4회 · 버리기 3회**로 시작합니다.
- 목표를 넘긴 **그 순간에만** 고·스톱 화면이 열립니다. 미리 대비할 수 없습니다.
- **고**는 문턱과 판돈을 함께 올립니다. 못 넘기면 그 판의 모든 것을 잃습니다.
- 1월부터 12월까지 열두 판. 12월을 넘기면 목표가 한 바퀴마다 ×1.6이 되는 **무한 달력**이 열립니다.

<br>

### 규모

| 카드 | 끗패 족보 | 수집 족보 | 부적 | 비결서 | 화공패 | 금단패 | 두목 | 스테이지 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **48**장 | **14**종 | **11**종 | **56**종 | **22**종 | **15**종 | **10**종 | **12**종 | **12**+∞ |

<br>

## 🚀 빠른 시작

```bash
git clone https://github.com/lshane1028/nhh-2026-hackathon.git
cd nhh-2026-hackathon

npm install
npm run dev          # http://localhost:3000
```

**Node.js 22.13.0 이상**이 필요합니다. 환경 변수 · API 키 · 데이터베이스는 필요하지 않습니다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (HMR) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run test` | Vitest 실행 (240개) |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | ESLint |
| `npm run verify` | **test → typecheck → lint → build** 전체 검증 |

<br>

## 🧱 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| UI | React 19 · Next 16 (App Router) | 화면이 12종이고 전부 같은 상태를 읽습니다. 라우팅보다 상태 공유가 중요해 단일 페이지 + 화면 전환 구조 |
| 번들 · 런타임 | Vite 8 + vinext | Next App Router를 Vite/RSC 위에서 구동해 Workers에 그대로 배포 |
| 배포 | GitHub Pages · Cloudflare Worker 호환 | 공개 링크는 정적 export, Worker 빌드는 보안 헤더와 이미지 최적화 경로 제공 |
| 스타일 | Tailwind 4 + 수제 CSS | 레이아웃은 유틸리티로, 카드 연출(재질·광택·도트 표식)은 CSS 직접 작성 |
| 타입 · 테스트 | TypeScript 5.9 · Vitest 4 | 규칙 엔진이 순수 함수라 33개 파일의 240개 테스트로 빠르게 검증 |
| 저장 | `localStorage` (스키마 버전 관리) | 계정 · 서버 없이 진행 저장. 규칙 변경 시 키를 올려 호환 불가 세이브를 폐기 |
| **런타임 AI** | **없음** | 시드 재현성과 일관된 규칙 판정을 보장하기 위한 의도적 배제 |

<br>

## 🗂️ 프로젝트 구조

```
nhh-2026-hackathon/
├── app/                        ── 프레젠테이션 레이어 (React)
│   ├── GameApp.tsx                 최상위 컨테이너. useReducer로 게임 상태를 들고 모든 화면을 조합
│   ├── layout.tsx                  루트 레이아웃 · 폰트 · 메타데이터
│   ├── page.tsx                    엔트리 페이지
│   ├── globals.css                 전역 리셋 · 폰트 정의
│   ├── game.css                    게임 화면 레이아웃 (단일 뷰포트)
│   ├── audio/
│   │   └── game-sfx.ts             효과음 재생 (Web Audio, 외부 파일 없음)
│   └── components/             ── props만 받는 프레젠테이션 컴포넌트
│       ├── TitleScreen.tsx         제목 · 시작 덱 · 튜토리얼 여부 선택
│       ├── AssetPlaceholder.tsx    자산이 없는 자리를 assetTag 텍스트로 대체
│       ├── PlayRail.tsx            상단 레일: 목표 · 진행도 · 점수 계산 막대 · 남은 자원
│       ├── HwatuCard.tsx           카드 한 장. 재질(각인) · 표면(판본) · 표식을 합성
│       ├── CardArt.tsx             카드 그림 로딩과 폴백
│       ├── CardMark.tsx            12×12 도트 SVG 표식 (곡선 미사용, crispEdges)
│       ├── CardActionTheater.tsx   카드 사용 · 개조 연출
│       ├── CollectionBoard.tsx     수집판. 덱에서 칸을 만들어 체크리스트로 렌더링
│       ├── MarketScreen.tsx        장터: 부적전 · 비결서점 · 덱 손질방 · 금단장
│       ├── TalismanStrip.tsx       보유 부적 슬롯 (순서 변경 가능)
│       ├── GameModal.tsx           규칙 · 덱 보기 · 선택 모달
│       ├── RunEndScreen.tsx        런 승리 / 패배 화면
│       ├── TutorialSpotlight.tsx   스포트라이트 오버레이 (실제 DOM 요소를 비춤)
│       ├── TutorialCoach.tsx       튜토리얼 말풍선
│       ├── tutorial-steps.ts       튜토리얼 22단계 정의
│       ├── card-visuals.ts         각인 → 재질, 판본 → 표면 매핑 (채널 분리의 단일 출처)
│       ├── hwatu-atlas.ts          48장 카드 그림의 위치 · 경로 조회
│       ├── generated-asset.ts      생성 자산 URL 해석
│       ├── useScoreReveal.ts       점수 연산을 순서대로 보여 주는 연출 훅
│       ├── art-direction.css       카드 재질 · 광택 표현
│       ├── pixel-direction.css     도트 렌더링 규칙 (보간 금지)
│       ├── game-ui.css             인게임 UI
│       └── screen-ui.css           화면 전환 · 모달
│
├── game/                       ── 게임 로직 (React 비의존 · 순수 TypeScript)
│   ├── types.ts                    전체 도메인 타입의 단일 출처
│   ├── content/                ── 선언형 데이터 카탈로그
│   │   ├── cards.ts                표준 화투 48장 정의
│   │   ├── yaku.ts                 끗패 족보 14종 · 수집 족보 11종
│   │   ├── talismans.ts            부적 56종
│   │   ├── upgrades.ts             화공패 15 · 금단패 10 · 비결서 22 · 각인 8 · 판본 4 · 낙관 4
│   │   ├── card-effects.ts         카드 효과 태그 12종
│   │   ├── bosses.ts               두목 12종과 거는 규칙
│   │   ├── stages.ts               1~12월 목표 곡선 · 날씨 · 무한 달력 배율
│   │   ├── meta.ts                 시작 덱 · 카드 묶음 · 계절 계약 · 날씨
│   │   └── index.ts                카탈로그 통합 + 선언 수량 ≡ 실제 수량 검증
│   ├── engine/                 ── 규칙 엔진 (순수 함수)
│   │   ├── yaku.ts                 짓 성립 판정 · 끗패 족보 판정 · 수집 진행도
│   │   ├── scoring.ts              점수 파이프라인 (가산 → 곱셈, 순서 보존)
│   │   ├── go.ts                   고 문턱 · 판돈 배율 · 초과 달성 방지 장치
│   │   ├── deck.ts                 덱 생성 · 셔플 · 드로우 · 카드 역할 해석
│   │   ├── rng.ts                  시드 + 커서 기반 결정론적 난수 (상태를 들지 않음)
│   │   ├── talismans.ts            부적 효과 적용과 발동 조건
│   │   ├── consumables.ts          화공패 · 금단패 사용 규칙과 대상 검증
│   │   ├── economy.ts              판돈 정산 · 상점 진열 · 가격 · 새로고침
│   │   ├── boss.ts                 두목 규칙이 득점에 개입하는 지점
│   │   ├── collection-bonus.ts     수집판 보상 계산 (채점기)
│   │   ├── collection-board.ts     수집판 화면용 칸 생성 (채점기와 일치해야 함)
│   │   └── experimental.ts         실험 규칙 토글
│   ├── state/                  ── 런 상태
│   │   ├── actions.ts              GameAction 32종 (판별 유니온)
│   │   ├── game.ts                 gameReducer — 상태 전이의 단일 진입점
│   │   └── storage.ts              localStorage 저장 · 스키마 버전 검사 · 정규화
│   └── tests/                  ── 자동 테스트 240개
│       ├── engine.test.ts          족보 판정 · 짓 성립 · 점수 연산 순서
│       ├── state.test.ts           상태 전이 · 고 · 술잔 · 팩 · 중복 정산 방지
│       ├── content.test.ts         콘텐츠 ID 유일성 · 태그 · 효과 연결
│       ├── collection-board.test.ts  화면 ≡ 채점기 불변식
│       ├── mobile-landscape.test.ts  모바일 가로 화면 안전 영역
│       └── …                       금단패 · 부적 · 오디오 · 툴팁 · 연출 · 저장
│
├── worker/
│   └── index.ts                    Cloudflare Worker 엔트리 · 이미지 최적화 라우트
├── build/
│   └── sites-vite-plugin.ts        배포용 Vite 플러그인
├── scripts/
│   └── slice-hwatu-atlas.py        생성 아틀라스를 160×240 격자로 결정론적 정렬 보정
│
├── assets/
│   └── manifest.json               자산 교체 정책과 파일명 규칙
├── public/assets/
│   ├── cards/hwatu/                카드 48장 (WebP) + 무손실 원본
│   ├── cards/effects/              카드 효과 오버레이 12종
│   ├── generated/                  부적 58 · 비결서 22 · 화공 15 · 금단 10 · 두목 4 · 인장 16 …
│   └── fonts/                      Galmuri 11 / 11 Bold / 14 (SIL OFL)
│
├── docs/
│   ├── submission/                 ── NAN 2026 제출 문서
│   │   ├── 03_게임소개및설명문서.pdf
│   │   └── 04_AI활용기술문서.pdf
│   ├── AI_USAGE_LOG.md             날짜별 AI 도구 · 목적 · 사람의 결정 · 검증 결과
│   ├── PROMPTS/                    실제 사용한 프롬프트 원문과 후처리 절차
│   ├── ASSET_LICENSES.md           시각 자산 출처 장부
│   ├── THIRD_PARTY_NOTICES.md      오픈소스 · 폰트 고지
│   ├── BALANCE_REPORT.md           목표 곡선을 정한 근거와 측정값
│   └── ASSET_REPLACEMENT_GUIDE.md  자산 교체 절차
│
├── HANDOFF.md                      규칙 전문과 설계 결정의 단일 기준 문서
├── vite.config.ts                  Vite + vinext + Cloudflare 플러그인
├── vitest.config.ts                테스트 설정
├── next.config.ts                  Next App Router 설정
└── package.json
```

<br>

## 🏗️ 아키텍처

의존 방향은 **위에서 아래로만** 흐릅니다. `engine`과 `content`는 React를 import하지 않으므로 Node에서 그대로 테스트됩니다.

```
┌───────────────────────────────────────────────────────────┐
│  app/                    프레젠테이션 — props만 받는 컴포넌트  │
└───────────────────────────┬───────────────────────────────┘
                            │  dispatch(GameAction)
┌───────────────────────────▼───────────────────────────────┐
│  game/state/             gameReducer — 상태 전이의 단일 진입점│
└──────────┬────────────────────────────────┬───────────────┘
           │                                │
┌──────────▼──────────┐        ┌────────────▼──────────────┐
│  game/engine/       │        │  game/content/            │
│  순수 함수 12모듈     │◀───────│  선언형 데이터 카탈로그      │
└─────────────────────┘        └───────────────────────────┘
           │
┌──────────▼────────────────────────────────────────────────┐
│  localStorage · flower-board-go:v2   스키마 버전 검사 + 정규화│
└───────────────────────────────────────────────────────────┘
```

**단방향 데이터 흐름** — UI는 액션만 던지고 상태를 직접 만지지 않습니다.

```
컴포넌트 ──dispatch──▶ GameAction ──▶ gameReducer ──▶ GameState
    ▲                                                    │
    └────────────── 렌더 + localStorage 자동 저장 ◀────────┘
```

<br>

### 시드 재현 — 커서 기반 RNG

난수 생성기가 **상태를 들고 다니지 않습니다.** `randomAt(seed, cursor)`는 FNV-1a 해시와 32비트 믹서로 시드·커서 쌍에서 값을 직접 계산하는 순수 함수입니다.

```
randomAt(seed, cursor) = mix32( fnv1a(seed) ⊕ (cursor+1)×0x9E3779B9 ) / 2³²
```

커서는 `GameState`에 정수로 들어 있으므로 저장 · 복원 · 되돌리기가 전부 공짜가 되고, **같은 시드는 언제나 같은 런**을 만듭니다.

<br>

## ✅ 테스트

```bash
npm run verify    # test → typecheck → lint → build
```

규칙이 자주 바뀌는 게임이라 회귀 방지에 비중을 뒀습니다. 현재 33개 테스트 파일에서 240개 사례를 실행합니다.

특히 **두 곳에 나뉘어 있는 같은 규칙**을 테스트로 못 박았습니다. 한쪽만 고쳐도 타입 검사와 린트는 통과하기 때문입니다.

| 불변식 | 잠그는 테스트 | 깨지면 |
|---|---|---|
| **화면 ≡ 채점기** | `collection-board.test.ts` | 수집판이 채점기가 세지 않는 카드를 약속합니다 |
| **목표 곡선 ≡ 측정값** | `balance-probe.test.ts` | 밸런스가 리뷰 없이 흘러갑니다 |
| **콘텐츠 선언 ≡ 실제** | `content.test.ts` | 상점 가중치와 문서가 조용히 어긋납니다 |
| **각인 ⟂ 판본** | `card-visuals.test.ts` | 산 강화가 화면에 표시되지 않습니다 |
| **점수 연산의 순서** | `engine.test.ts` · `state.test.ts` | 같은 패가 상황에 따라 다른 점수를 냅니다 |

<br>

## 🤖 AI 활용

기획 검증 · 규칙 엔진 · 콘텐츠 · UI · 아트 · 테스트 전 공정에 AI를 사용했습니다.
**단, 런타임에는 어떤 생성형 AI나 유료 API도 호출하지 않습니다.**

- 시드 재현성을 보장하기 위해 — 모델 호출이 섞이면 같은 시드가 같은 런을 만들지 못합니다
- 심사자가 API 키 없이 링크만으로 실행할 수 있게 하기 위해
- 결정론적 순수 함수여야 240개의 테스트로 주요 규칙을 잠글 수 있기 때문에

사용한 프롬프트 원문은 [`docs/PROMPTS/`](docs/PROMPTS), 작업 로그는 [`docs/AI_USAGE_LOG.md`](docs/AI_USAGE_LOG.md),
전체 기술 설명은 [`docs/submission/`](docs/submission)의 **AI 활용 기술 문서**에 있습니다.

<br>

## 📄 제출 문서

현재 코드와 문서의 차이, 구조·게임·아트·성능 개선 우선순위는
[`docs/REPOSITORY_AUDIT_2026-08-12.md`](docs/REPOSITORY_AUDIT_2026-08-12.md)에 정리되어 있습니다.

| 문서 | 위치 |
|---|---|
| 게임 소개 및 설명 문서 | [`docs/submission/03_게임소개및설명문서.pdf`](docs/submission) |
| AI 활용 기술 문서 | [`docs/submission/04_AI활용기술문서.pdf`](docs/submission) |
| 규칙 전문 · 설계 결정 | [`HANDOFF.md`](HANDOFF.md) |
| 밸런스 근거 | [`docs/BALANCE_REPORT.md`](docs/BALANCE_REPORT.md) |

<br>

## 🙏 크레딧

- **폰트** — [Galmuri](https://github.com/quiple/galmuri) by quiple · SIL Open Font License 1.1
- **시각 자산** — 원본 화투의 구조를 기준으로 OpenAI 이미지 생성으로 제작한 프로젝트 전용 자산
- **오픈소스** — React · Vite · vinext · Tailwind CSS · Cloudflare Wrangler · TypeScript · Vitest ([전체 고지](docs/THIRD_PARTY_NOTICES.md))

<br>

<div align="center">

**NAN 2026 · NHN Game × AI Hackathon**

</div>
