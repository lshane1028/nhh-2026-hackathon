# AI 활용 로그

## 2026-08-03 — 구현 시작

- 도구/모델: OpenAI Codex, GPT-5 계열(세부 런타임 버전 비공개)
- 목적: 《꽃판: GO!》 기획서를 모듈형 웹게임 프로토타입으로 구현
- 프롬프트 ID: `prompt-2026-08-03-build-001`
- 입력 권리: 참가자가 제공한 요구사항과 이 저장소의 자체 작성 기획서
- 사람의 결정: 이미지 생성 금지, 모든 시각 자산은 `assetTag`가 붙은 텍스트 플레이스홀더로 구현
- 결과 상태: 플레이 가능한 텍스트 프로토타입 구현 및 자동 검증 완료
- 관련 파일: `docs/PROMPTS/prompt-2026-08-03-build-001.md`, `game/`, `app/`
- 주요 결과: 규칙·콘텐츠·경제·상태 엔진, 1~12월 UI, 자동 저장, 제출 문서
- 이미지 정책: 생성 이미지 0장, 외부 이미지 0장, 모든 자리는 `assetTag` 텍스트
- 자동 검증: Vitest 28개 테스트, TypeScript, ESLint, vinext 프로덕션 빌드
- 관련 커밋: 로컬 작업 트리(사용자 요청 전에는 원격 게시·PR 생성 안 함)

## 2026-08-06 — 짓고땡 전환

- 도구/모델: Anthropic Claude (Cowork)
- 목적: 포커식 즉시 족보 17종을 전통 화투 놀이 **짓고땡** 기반 규칙으로 교체
- 사람의 결정: 짓고땡 채택, 5장 고정을 2~5장 자유 제출로 일반화, 카드 효과는 태그만 붙이고 엔진 구현은 보류
- 결과 상태: 끗패 14종·짓 분할·밸런스 재조정·튜토리얼 재작성 완료
- 관련 파일: `game/content/yaku.ts`, `game/engine/yaku.ts`, `game/engine/scoring.ts`, `game/content/stages.ts`, `app/components/tutorial-steps.ts`, `HANDOFF.md`
- 자동 검증: Vitest 66개 테스트(완전 탐색 밸런스 프로브 포함), TypeScript, ESLint
- 문서 정리: 실효성을 잃은 `01_GAME_DESIGN_PLAN.md`·`02_MASTER_BUILD_PROMPT.md`·`03_DEVELOPMENT_HANDOFF.md`를 삭제하고 `HANDOFF.md` 하나로 통합

## 2026-08-10 — 최종 규칙·자산·연출 통합

- 도구/모델: OpenAI Codex, OpenAI 이미지 생성
- 목적: 현재 규칙과 화면의 불일치 제거, 《경화수월》 브랜드 확정, 자산·연출·오디오 최종 통합
- 프롬프트 ID: `prompt-2026-08-10-current-rule-assets`
- 사람의 결정: 전통 문양과 오방색 계열 방향, 현재 규칙의 이름과 기능을 그림에 직접 연결, 런타임 AI 미사용 유지
- 주요 결과: 카드 제출 극장, 금단패 전용 연출, 계절 두목 등장 패널, 시작 덱·계절 인물·두목 자산, 툴팁 레이어, 재즈 테이블 BGM과 상황별 효과음
- 관련 파일: `app/`, `game/`, `public/assets/`, `docs/HANDOFF_CURRENT_RULE_REFACTOR_2026-08-10.md`
- 자동 검증: Vitest 29개 파일, 214개 테스트 통과

## 2026-08-10 — NAN 2026 제출 PDF 최종화

- 도구/모델: OpenAI Codex
- 목적: 전체 커밋과 최신 구현을 반영해 3번 게임 소개, 4번 AI 활용, 5번 팀 소개 PDF 작성
- 사람의 결정: 팀원 역할은 커밋 저자·변경 파일·최종 구현을 근거로 정리하고 커밋 수를 기여 비율로 환산하지 않음
- 주요 결과: 《경화수월》 명칭·214개 테스트·보스·오디오·배포 내역 반영, 기존 공백 페이지와 빈 실행 링크 제거, 2인 팀 역할 문서 신규 작성
- 검증: 세 PDF를 PNG로 전 페이지 렌더링해 글자 깨짐·겹침·잘림을 확인
- 관련 파일: `docs/submission/`, `docs/SUBMISSION_*.md`, `scripts/build_submission_pdfs.py`
