# 꽃판: GO!

48장 화투와 고·스톱을 결합한 싱글 플레이 로그라이크 덱빌더 웹게임 프로토타입이다. 모든 시각 자산은 실제 이미지 없이, 교체 가능한 `assetTag` 텍스트 플레이스홀더로 표시한다.

## 실행

```bash
npm install
npm run dev
```

- 개발 서버: `http://localhost:3000`
- 전체 검증: `npm run verify`
- 규칙 테스트: `npm run test`

Node.js `22.13.0` 이상이 필요하다. 진행 중인 런은 브라우저 `localStorage`에 자동 저장된다.

## 조작과 진행

1. 시작 덱 10종 중 하나와 실험 규칙을 고른다.
2. 손에서 1~5장을 눌러 즉시 족보를 만들고 `족보 제출`을 누른다.
3. 점수는 `floor(월 합 × 배수)`로 계산된다.
4. `안전 정산`, `고`, `스톱` 중 하나를 고른다. 고 실패 시 이번 승부 점수와 진행 중 수집·숙련이 사라진다.
5. 매달 장터에서 부적, 화공패, 비결서, 금단패 중 한 경로를 고쳐 나간다.
6. 3·6·9월 뒤에는 계절 계약을 고르고, 12월 두목을 이기면 무한 달력이 열린다.

## 구조

```text
app/                     화면 조합, 반응형 UI, 텍스트 플레이스홀더
app/components/          props 기반 프레젠테이션 컴포넌트
game/content/            48장·족보·부적·강화·두목·상점 데이터
game/engine/             RNG·족보·점수·고·강화·경제 순수 함수
game/state/              런 리듀서, 액션, 버전 저장
game/tests/              규칙·카탈로그·전체 상태 전이 테스트
assets/manifest.json     이미지 교체 정책과 파일명 규칙
docs/                    제출·AI 활용·라이선스·밸런스 문서
```

## 이미지 교체

화면의 모든 자리에는 사람이 읽을 수 있는 이름과 `assetTag`가 함께 보이고, DOM에도 `data-asset-tag`가 붙는다. 태그 규칙과 교체 절차는 `docs/ASSET_REPLACEMENT_GUIDE.md`를 따른다. 현재 저장소에는 생성 이미지나 외부 이미지가 한 장도 없다.

## NAN 2026 제출 기록

런타임 AI API는 사용하지 않는다. Codex를 기획 검증·규칙 엔진·테스트·UI 구현에 사용한 내역과 프롬프트는 `docs/AI_USAGE_LOG.md`, `docs/PROMPTS/`에 기록했다. 외부 자산과 라이선스 현황은 `docs/ASSET_LICENSES.md`, `docs/THIRD_PARTY_NOTICES.md`에서 확인할 수 있다.
