import { describe, expect, it } from "vitest";

import { getCupChoiceActionLabels } from "../../app/components/CupChoiceModal";

describe("cup choice copy", () => {
  it("puts the current and resulting collection counts directly on both choices", () => {
    const labels = getCupChoiceActionLabels({
      current: { animal: 3, chaff: 7 },
      animal: { animal: 4, chaff: 7 },
      doubleChaff: { animal: 3, chaff: 9 },
    });

    expect(labels.animal).toBe("동물로 기록\n동물 3→4장 · 피 7→7점");
    expect(labels.chaff).toBe("피로 기록\n동물 3→3장 · 피 7→9점");
  });
});
