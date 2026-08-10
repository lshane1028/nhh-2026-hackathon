# 2026-08-10 현재 규칙 전용 이미지 생성 기록

모드: OpenAI 이미지 생성 `text-to-image`. 생성 원본은 PNG로 보존하고, 게임에서는 2:3 WebP로 정규화해 사용한다.

공통 방향: 짙은 먹색·주홍·금박·한지 질감의 한국 전통 다크 판타지 픽셀 아트. 작은 상품 카드에서도 기능이 읽히는 중심 구도와 안전 여백을 사용했다. 모든 프롬프트에서 글자·숫자·로고·깃발·방사형 광선·일본풍 상징을 금지했다.

## 계절 결산 장면

- `spring-stranger.webp`: 벚꽃 밤길의 봄 사내와 약조 두루마리.
- `summer-stranger.webp`: 장맛비 정자의 여름 무녀와 놋쇠 술잔.
- `autumn-stranger.webp`: 억새·보름달 아래 가을 장사꾼과 자물쇠 상자.
- `winter-stranger.webp`: 눈 덮인 산사 문 앞 겨울 노파와 붉은 매듭 꾸러미.

각 장면은 인물과 계절 배경을 함께 그리되, 아래쪽에 게임 대사 상자가 겹칠 어두운 여백을 확보했다.

## 덱 손질방 꾸러미

- `book-*.webp`: 쪽빛 보자기 안의 전통 제본 비결서.
- `talisman-*.webp`: 붉은 비단 복주머니와 부적 카드, 전통 매듭.
- `burn-*.webp`: 화투패를 태우는 검은 놋쇠 화로.
- `hwatu-medium.webp`: 기존 화투 꾸러미 계열의 중간 크기 상품용 정규화본.

## 우두머리

- `falling-first.webp`: 첫 낙화를 베어 월값을 지우는 가면 쓴 정원사.
- `drought.webp`: 갈라진 논과 빈 비 그릇을 든 가뭄 도사.
- `dark-cloud.webp`: 광의 빛을 먹구름으로 지우는 구름 술사.
- `ribbon-scissors.webp`: 첫 제출의 띠를 자르는 수상한 재봉사.
- `lost-pair-moon.webp`: 자주 쓴 달을 약화하는 깨진 쌍월 거울의 관상감.
- `tax-collector.webp`: 버린 패마다 엽전을 요구하는 세금쟁이.
- `reversed-screen.webp`: 보충패 두 장을 뒤집는 병풍 화공.
- `go-bond.webp`: 고 실패 판돈을 붉은 끈으로 묶어 깎는 고박 채권자.

## 원본과 출력

생성 원본: `C:/Users/mike0/.codex/generated_images/019fe604-b1f7-7ab1-a1cd-3b22a458959c/*.png`

게임 출력:

- `public/assets/generated/seasons/*.webp`
- `public/assets/generated/packs/*.webp`
- `public/assets/generated/bosses/*.webp`

