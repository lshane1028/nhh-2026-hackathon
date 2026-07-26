# 꽃패도: 열두 달의 판

전통 화투의 월 맞추기와 고·스톱의 긴장에 로그라이트 판술을 결합한 싱글플레이 웹 카드 게임입니다.

현재 브랜치는 한 판을 처음부터 끝까지 플레이할 수 있는 수직 슬라이스입니다.

## 현재 구현

- 1월부터 12월까지 48장 화투덱
- 플레이어와 세 판주가 참여하는 네 자리 경쟁판
- 각자 손패 5장, 바닥패 8장, 차례마다 산패 뒤집기
- 광·띠·열끗을 서로 빼앗는 성향별 판주 AI
- 같은 월 패 먹기와 광·열끗·띠·피 분류
- 삼광·사광·오광·홍단·청단·고도리와 계절 족보
- 판술 3종: 산패보기, 달넘기, 휘몰이
- 봄 판주 ‘매화 선비’의 목표 점수 방해 규칙
- 목표 달성 후 고·스톱 선택
- 최대 3고, 점수 배수, 결과와 즉시 재도전
- Web Audio로 합성한 카드 타격·뒤집기·쓸어오기·족보·도장 사운드
- 카드 내리치기, 충격파, 파편, 화면 흔들림, 갈무리 애니메이션
- 마우스·터치 입력과 반응형 캔버스
- 생성 이미지 기반 2.5D 화투방, 월 원화, 판주 원화

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

`wrangler.jsonc`는 빌드 결과물 `dist/`를 Cloudflare Worker의 정적 에셋으로 배포하도록 설정되어 있습니다.

```bash
pnpm deploy
```

Cloudflare Pages를 사용할 때는 다음 값으로 연결합니다.

- Build command: `pnpm build`
- Build output directory: `dist`
- Node.js: 20 이상

## 프로젝트 구조

```text
public/assets/art/   생성 이미지 원본
src/game/            카드 데이터와 순수 규칙
src/scenes/          Phaser 화면과 진행 흐름
src/ui/              카드 UI 컴포넌트
docs/                기획서와 AI 에셋 기록
```

## 문서

- [게임 기획서](docs/게임_기획서_꽃패도.md)
- [네 자리 수직 슬라이스 설계](docs/FOUR_SEAT_VERTICAL_SLICE.md)
- [AI 에셋 제작 기록](docs/AI_ASSET_MANIFEST.md)
