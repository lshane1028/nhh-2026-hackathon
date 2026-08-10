import type { CSSProperties } from "react";

export type BossSeason = "spring" | "summer" | "autumn" | "winter";

const BOSS_SEASON_BY_MONTH: Readonly<Partial<Record<number, BossSeason>>> = {
  3: "spring",
  6: "summer",
  9: "autumn",
  12: "winter",
};

const PARTICLE_COUNT: Record<BossSeason, number> = {
  spring: 30,
  summer: 36,
  autumn: 26,
  winter: 36,
};

export function getBossSeasonForMonth(month: number, bossActive = true): BossSeason | null {
  return bossActive ? BOSS_SEASON_BY_MONTH[month] ?? null : null;
}

function particleStyle(index: number): CSSProperties {
  const drift = ((index * 29) % 96) - 48;
  return {
    "--season-x": `${(index * 37 + 9) % 101}%`,
    "--season-delay": `${-((index * 17) % 41) / 4}s`,
    "--season-duration": `${5.4 + ((index * 11) % 31) / 5}s`,
    "--season-rain-duration": `${0.66 + ((index * 7) % 9) / 20}s`,
    "--season-snow-duration": `${8.8 + ((index * 11) % 31) / 4}s`,
    "--season-drift": `${drift}px`,
    "--season-drift-back": `${Math.round(drift * -0.55)}px`,
    "--season-drift-tail": `${Math.round(drift * 0.35)}px`,
    "--season-scale": `${0.62 + ((index * 7) % 11) / 14}`,
  } as CSSProperties;
}

export function BossSeasonOverlay({ season }: { season: BossSeason | null }) {
  if (!season) return null;
  return (
    <div className={`boss-season-fx boss-season-fx--${season}`} data-season={season} aria-hidden="true">
      {Array.from({ length: PARTICLE_COUNT[season] }, (_, index) => (
        <i className="boss-season-fx__particle" key={index} style={particleStyle(index)} />
      ))}
    </div>
  );
}
