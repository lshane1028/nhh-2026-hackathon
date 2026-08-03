# 텍스트 플레이스홀더 → 이미지 교체 가이드

## 현재 원칙

- 저장소에 생성 이미지와 외부 이미지는 없다.
- 모든 시각 자리는 `AssetPlaceholder`로 렌더링한다.
- 화면에는 이름과 `assetTag`가 보이며 DOM에는 `data-asset-tag="..."`가 붙는다.
- 카드 자체에도 고유 `assetTag`가 있어 48장을 서로 다른 그림으로 교체할 수 있다.

## 태그와 파일명

`assetTag`는 논리 식별자이므로 콜론을 포함할 수 있다. Windows 파일명에는 콜론을 쓸 수 없으므로 실제 파일명에서는 `:`를 `__`로 치환한다.

예시:

```text
talisman:goblin-mirror
→ public/assets/talismans/talisman__goblin-mirror.webp

card-01-bright-crane
→ public/assets/cards/card-01-bright-crane.webp
```

## 나중에 붙이는 순서

1. `assets/manifest.json`의 `tagSources`에서 필요한 태그를 검색한다.
2. 같은 태그를 이미지 생성 프롬프트와 파일 메타데이터에 기록한다.
3. 위 파일명 규칙으로 `public/assets/{category}/`에 넣는다.
4. 중앙 에셋 레지스트리에서 `assetTag → 파일 경로`를 연결한다.
5. `AssetPlaceholder`의 텍스트·접근성 정보는 유지하고 그림을 장식 레이어로 추가한다.
6. `docs/ASSET_LICENSES.md`에 제작자, 도구, 날짜, 라이선스, 원본 프롬프트를 기록한다.

## 금지 사항

- 출처나 사용 조건을 확인하지 않은 이미지를 바로 넣지 않는다.
- 화투 전통 도상을 그대로 베낀 상업 제품 이미지를 사용하지 않는다.
- 태그 없이 파일만 추가하지 않는다. 태그가 제출 기록과 코드 사이의 추적 키다.
