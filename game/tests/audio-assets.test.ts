import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GAME_AUDIO_ASSETS,
  playCashRegisterSound,
  playCollectionSlapSound,
  playCollectionSlideSound,
  playShopPurchaseSound,
  resolveGameMusicScene,
} from "../../app/audio/game-sfx";

function publicAssetPath(url: string): string {
  return fileURLToPath(new URL(`../../public${url}`, import.meta.url));
}

describe("game audio assets", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ships every sample referenced by the audio catalog", () => {
    const urls = Object.values(GAME_AUDIO_ASSETS).flatMap((value) =>
      typeof value === "string" ? [value] : [...value],
    );
    expect(new Set(urls).size).toBe(urls.length);
    urls.forEach((url) => {
      const path = publicAssetPath(url);
      expect(existsSync(path), `${url} should exist`).toBe(true);
      expect(statSync(path).size, `${url} should not be empty`).toBeGreaterThan(3_500);
    });
  });

  it("records a CC0 source for every included audio collection", () => {
    const noticePath = fileURLToPath(new URL("../../public/assets/audio/THIRD_PARTY_NOTICES.md", import.meta.url));
    const notice = readFileSync(noticePath, "utf8");
    expect(notice).toContain("Kenney Casino Audio");
    expect(notice).toContain("Kenney Interface Sounds");
    expect(notice).toContain("Kenney Music Jingles");
    expect(notice).toContain("Moil");
    expect(notice).toContain("Oh! boss!");
    expect(notice).toContain("Jazzy Vibes #36");
    expect(notice).toContain("Thwack Sounds");
    expect(notice).toContain("Cash Register (imitation with toaster and bells)");
    expect(notice).toContain("Coin Drop");
    expect(notice).toContain("58 Random Sound Effects");
    expect(notice).toContain("Menu Music");
    expect(notice).toContain("Shop Theme");
    expect(notice).toContain("Dark Shrine Loop");
    expect(notice).toContain("Snowfall");
    expect(notice).toContain("Purchasing Sound Effect");
    expect(notice).toContain("Plastic Cards (credit, debit, etc)");
    expect(notice).toContain("Plastic Click");
    expect(notice).toContain("Face Slap Sound Effect");
    expect(notice.match(/creativecommons\.org\/publicdomain\/zero\/1\.0/g)).toHaveLength(21);
  });

  it("selects distinct title, shop, and seasonal boss music scenes", () => {
    expect(resolveGameMusicScene("title")).toBe("title");
    expect(resolveGameMusicScene("shop")).toBe("shop");
    expect(resolveGameMusicScene("play", 3)).toBe("boss-spring");
    expect(resolveGameMusicScene("play", 6)).toBe("boss-summer");
    expect(resolveGameMusicScene("decision", 9)).toBe("boss-autumn");
    expect(resolveGameMusicScene("round_intro", 12)).toBe("boss-winter");
    expect(resolveGameMusicScene("play", null)).toBe("table");
  });

  it("plays the real till and card-swipe recordings at their game cues", async () => {
    const played: string[] = [];
    class FakeAudio {
      currentTime = 0;
      ended = false;
      paused = true;
      playbackRate = 1;
      preload = "";
      volume = 1;

      constructor(public readonly src: string) {}
      load() {}
      pause() { this.paused = true; }
      play() {
        this.paused = false;
        played.push(this.src);
        return Promise.resolve();
      }
    }

    vi.useFakeTimers();
    vi.stubGlobal("window", {
      Audio: FakeAudio,
      clearTimeout,
      localStorage: { getItem: () => null, setItem: () => undefined },
      setTimeout,
    });

    playCashRegisterSound();
    expect(played).toContain(GAME_AUDIO_ASSETS.cashRegister);
    await vi.advanceTimersByTimeAsync(130);
    expect(played).toContain(GAME_AUDIO_ASSETS.coinDrop);

    played.length = 0;
    playCollectionSlideSound(1);
    expect(played).toContain(GAME_AUDIO_ASSETS.hwatuSwipe[1]);
    expect(played).toContain(GAME_AUDIO_ASSETS.cardSlide[1]);

    played.length = 0;
    playCollectionSlapSound(2);
    expect(played).toContain(GAME_AUDIO_ASSETS.hwatuFaceSlap);
    expect(played).toContain(GAME_AUDIO_ASSETS.hwatuPlasticCards);
    await vi.advanceTimersByTimeAsync(22);
    expect(played).toContain(GAME_AUDIO_ASSETS.hwatuPlasticSnap);

    played.length = 0;
    playShopPurchaseSound("talisman");
    expect(played).toContain(GAME_AUDIO_ASSETS.shopPurchase);
    await vi.advanceTimersByTimeAsync(95);
    expect(played).toContain(GAME_AUDIO_ASSETS.reset);
  });
});
