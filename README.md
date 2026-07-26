# 꽃패도: 열두 달의 길

전통 화투의 손맛과 네 자리 경쟁 위에, 계절별 경로 선택·전술 덱·유물 빌드를 얹은 브라우저용 로그라이트 카드 게임입니다.

현재 브랜치는 한 판짜리 고스톱 데모가 아니라, 봄부터 겨울까지 이어지는 4스테이지 로그라이트 수직 슬라이스입니다.

## 핵심 플레이

- 플레이어 1명과 규칙 기반 상대 3명이 참여하는 네 자리 화투
- 각자 손패 5장, 바닥패 8장으로 시작하는 빠른 대국
- 같은 달 패 맞추기와 광·열끗·띠·피 수집
- 오광·사광·삼광·홍단·청단·초단·고도리 족보
- 목표 점수 달성 후 `고`와 `스톱` 선택
- 카드 충돌, 포획, 족보, 낙관을 강조한 Web Audio 사운드와 화면 효과

## 로그라이트 구조

- 봄·여름·가을·겨울의 4스테이지 런
- 매 계절 안전한 길과 위험한 길 중 하나를 고르는 분기 지도
- 조우마다 달라지는 전장 규칙, 목표 점수, 상대 보너스
- 8종 전술이 들어가는 별도의 전술 덱과 매 대국 3장 무작위 드로우
- 전술 추가·유물·회복 중 하나를 고르는 3택 보상
- 8종 유물의 영구 효과와 광·띠·열끗·전술 중심 빌드
- 체력, 명성, 패배 방지 효과가 런 전체에 유지

세부 의도와 밸런스 기준은 [로그라이트 재설계 문서](docs/ROGUELITE_REDESIGN.md)에 정리했습니다.

## 기술 구성

- Phaser 3
- TypeScript
- Vite
- Vitest
- Cloudflare Workers Static Assets / Pages 호환 정적 빌드

## 실행

Node.js 20 이상과 pnpm이 필요합니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:5173`을 엽니다.

## 검증

```bash
pnpm test
pnpm build
pnpm preview
```

## Cloudflare 배포

```bash
pnpm deploy
```

Cloudflare Pages를 사용할 때의 설정:

- Build command: `pnpm build`
- Build output directory: `dist`
- Node.js: 20 이상

## 프로젝트 구조

```text
public/assets/art/   생성 이미지 원본
src/game/            카드 데이터, 점수 규칙, 런 영속 상태
src/scenes/          타이틀, 지도, 대국, 보상, 결말 화면
src/ui/              카드 UI 컴포넌트
docs/                기획서, 수직 슬라이스 및 에셋 기록
```

## 문서

- [게임 기획서](docs/게임_기획서_꽃패도.md)
- [로그라이트 재설계](docs/ROGUELITE_REDESIGN.md)
- [네 자리 수직 슬라이스 설계](docs/FOUR_SEAT_VERTICAL_SLICE.md)
- [AI 에셋 제작 기록](docs/AI_ASSET_MANIFEST.md)
