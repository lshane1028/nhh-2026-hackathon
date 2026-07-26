# AI 에셋 제작 기록

게임에서 사용하는 생성 이미지의 목적과 제작 기준을 기록한다. 생성 이미지는 그대로 규칙 정보를 담당하지 않는다. 월, 종류, 점수와 족보는 TypeScript 데이터와 UI가 정확하게 표시한다.

## 공통 아트 원칙

- 핵심 팔레트: 먹색, 주홍, 옥색, 놋쇠색, 빛바랜 한지색
- 한국적 마술적 리얼리즘과 정돈된 저해상도 로우폴리 감각
- 특정 게임의 감옥, 슬롯머신, 카지노, 캐릭터 디자인을 모방하지 않음
- 생성 이미지 안에 읽어야 하는 글자나 숫자를 넣지 않음
- 얼굴·손·문양의 오류가 규칙 전달에 영향을 주지 않도록 코드 UI와 분리
- 플레이 중 실시간 이미지·문장 생성은 사용하지 않음

## 1. 자정의 화투방

파일: `public/assets/art/midnight-card-room.png`

용도: 제목 화면과 플레이 화면의 고정 시점 배경

최종 생성 프롬프트:

```text
Use case: stylized-concept
Asset type: 16:9 game environment background for a browser card game
Primary request: a small old Korean flower-card room at midnight, viewed from a seated player's fixed first-person perspective across a low lacquer table; the opposite chair is empty and ominous; a twelve-panel seasonal folding screen behind it subtly comes alive
Scene/backdrop: intimate worn room with old wallpaper, wood trim, a brass scale, red seal stamp, ledger, charm box, dim fluorescent ceiling light and cool moonlight through one side window
Subject: the empty lacquer tabletop must occupy the lower central third and remain clean enough for interactive cards and UI overlays; empty opponent seat at center distance; seasonal folding screen in the back
Style/medium: original stylized low-poly 3D game render, restrained late-1990s retro geometry, Korean magical realism, slightly hand-painted low-resolution textures; not pixel art
Composition/framing: wide 16:9, symmetrical fixed camera, strong depth layers for subtle parallax, clear negative space over the tabletop and along top corners for UI
Lighting/mood: familiar and nostalgic at first glance, quietly uncanny after midnight, warm tungsten and muted teal moonlight, no gore, no overt horror
Color palette: ink black, muted vermilion, jade green, aged brass, tobacco brown
Materials/textures: worn lacquer, paper, dark wood, aged metal, thick plastic flower cards hinted only as a small facedown deck
Constraints: no people, no readable text, no symbols resembling a commercial logo, no slot machine, no prison cell, no casino neon, no clutter on the central play area, no watermark, no borders
```

## 2. 열두 달 원화 아틀라스

파일: `public/assets/art/month-art-atlas.png`

용도: 4×3 스프라이트 시트로 잘라 48장 화투패의 월별 원화에 사용

셀 순서:

```text
1월 송학 | 2월 매조 | 3월 벚꽃 | 4월 흑싸리
5월 난초 | 6월 모란 | 7월 홍싸리 | 8월 공산
9월 국화 | 10월 단풍 | 11월 비 | 12월 오동
```

최종 생성 프롬프트:

```text
Use case: stylized-concept
Asset type: game card illustration atlas, twelve month motifs
Primary request: exactly twelve distinct Korean flower-card inspired botanical and seasonal illustrations arranged in a perfectly regular 4-column by 3-row grid, one centered motif per equal cell, intended to be cropped into individual card artworks
Subject order left-to-right, top-to-bottom: 1 pine and rising sun; 2 plum blossom and small bird; 3 cherry blossom curtain; 4 wisteria and cuckoo; 5 iris by a small bridge; 6 peony and butterfly; 7 red bush clover and boar; 8 silver pampas grass under full moon; 9 chrysanthemum and sake cup; 10 red maple and deer; 11 willow in rain with a poised human silhouette under an umbrella; 12 paulownia and phoenix
Style/medium: original Korean minhwa and woodblock-inspired flat illustration, simplified bold silhouettes, crisp hand-painted texture, suitable for a modern premium card game; not photorealistic
Composition/framing: strict orthographic front view, exact equal-size grid cells, consistent scale, generous inner padding, each motif isolated within its own rectangular cream-paper panel
Lighting/mood: flat print lighting, no cast shadows
Color palette: ink black, muted vermilion, jade, cream, aged brass, small accents of deep blue
Materials/textures: aged hanji paper, woodblock ink, restrained gold leaf accents
Constraints: exactly 12 cells, no letters, no numbers, no labels, no borders between cells thicker than a thin dark guide, no extra panels, no text, no watermark, no playing-card suits, no western card symbols, no commercial logos
```

## 3. 네 판주 아틀라스

파일: `public/assets/art/boss-atlas.png`

용도: 2×2 스프라이트 시트. 봄 수직 슬라이스에서는 첫 번째 프레임인 매화 선비를 사용한다.

최종 생성 프롬프트:

```text
Use case: stylized-concept
Asset type: four boss portrait atlas for a Korean magical-realist browser card game
Primary request: exactly four distinct supernatural Korean flower-card table opponents arranged in a perfectly regular 2-column by 2-row grid, each shown seated behind a low card table from the player's eye level
Subject order left-to-right, top-to-bottom: spring plum scholar with a face hidden by a folding fan and red ribbon; summer rain dokkaebi merchant beneath a broad wet hat, only weathered hands visible; autumn moon fox gambler wearing a restrained ivory half-mask and dark hanbok; winter empty-seat spirit represented by floating black sleeves and a red seal stamp with no body
Style/medium: original stylized low-poly 3D character render with hand-painted low-resolution textures, Korean magical realism, restrained late-1990s game aesthetic, strong readable silhouettes
Composition/framing: strict equal 2x2 portrait atlas, centered waist-up figures, same camera and scale in every cell, dark simple backdrop, safe margins for cropping
Lighting/mood: mysterious, dignified, a little uncanny but not horror; dramatic side light
Color palette: ink black, muted vermilion, jade, aged ivory, tarnished brass
Constraints: no text, no labels, no watermark, no gore, no exposed monster teeth, no casino imagery, no slot machines, no commercial logos, no modern clothing, no extra panels
```

## 사용 도구와 후처리

- 생성: OpenAI 내장 이미지 생성 도구
- 후처리: 원본 PNG를 변경하지 않고 Phaser 스프라이트 프레임으로 분할
- 규칙 표기: Phaser의 텍스트와 벡터 도형으로 별도 합성
- 사람 검수: 배경 구성, 월별 프레임 대응, 카드 판독성, 브라우저 화면 비율 확인

