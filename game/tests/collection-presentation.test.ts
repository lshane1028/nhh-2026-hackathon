import { describe, expect, it } from "vitest";

import { getVisibleCollectionCardIdsByTrack } from "../../app/GameApp";
import { createStandardHwatuDeck } from "../engine/deck";

describe("collection landing presentation", () => {
  it("reveals a multi-kind card only in each track that has actually landed", () => {
    const baseId = "already-collected";
    const source = createStandardHwatuDeck().find((card) => card.kind === "animal")!;
    const card = {
      ...source,
      tags: [...source.tags, "counts_as_bright"],
      effectTagId: "extra_pi",
    };

    const beforeLanding = getVisibleCollectionCardIdsByTrack(
      [baseId],
      [card],
      {},
      new Set(),
    );
    expect(beforeLanding.bright).toEqual([baseId]);
    expect(beforeLanding.animal).toEqual([baseId]);
    expect(beforeLanding.chaff).toEqual([baseId]);

    const afterBrightAndAnimal = getVisibleCollectionCardIdsByTrack(
      [baseId],
      [card],
      {},
      new Set([`bright:${card.instanceId}`, `animal:${card.instanceId}`]),
    );
    expect(afterBrightAndAnimal.bright).toEqual([baseId, card.instanceId]);
    expect(afterBrightAndAnimal.animal).toEqual([baseId, card.instanceId]);
    expect(afterBrightAndAnimal.chaff).toEqual([baseId]);
  });
});
