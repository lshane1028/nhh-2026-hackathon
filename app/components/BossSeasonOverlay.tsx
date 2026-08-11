"use client";

import { useEffect, useRef } from "react";
import { createTimeline } from "animejs/timeline";

export type BossSeason = "spring" | "summer" | "autumn" | "winter";

const BOSS_SEASON_BY_MONTH: Readonly<Partial<Record<number, BossSeason>>> = {
  3: "spring",
  6: "summer",
  9: "autumn",
  12: "winter",
};

const PARTICLE_COUNT: Record<BossSeason, number> = {
  spring: 78,
  summer: 96,
  autumn: 68,
  winter: 112,
};

interface SeasonParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  opacity: number;
  depth: number;
  phase: number;
  variant: number;
}

interface SeasonScene {
  gust: number;
  flash: number;
  haze: number;
}

export function getBossSeasonForMonth(month: number, bossActive = true): BossSeason | null {
  return bossActive ? BOSS_SEASON_BY_MONTH[month] ?? null : null;
}

function unit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createParticles(season: BossSeason, width: number, height: number): SeasonParticle[] {
  const compact = width < 720;
  const count = Math.round(PARTICLE_COUNT[season] * (compact ? 0.66 : 1));
  return Array.from({ length: count }, (_, index) => {
    const depth = 0.34 + unit(index, 1) * 0.66;
    const rain = season === "summer";
    const snow = season === "winter";
    return {
      x: unit(index, 2) * width,
      y: unit(index, 3) * height,
      vx: rain ? -90 - unit(index, 4) * 90 : -9 + unit(index, 4) * 18,
      vy: rain
        ? 620 + unit(index, 5) * 520
        : snow
          ? 22 + depth * 42
          : 35 + depth * 68,
      size: rain ? 18 + depth * 28 : snow ? 4 + depth * 8 : 12 + depth * 18,
      rotation: unit(index, 6) * Math.PI * 2,
      spin: rain ? 0 : (-1 + unit(index, 7) * 2) * (0.7 + depth * 1.9),
      opacity: 0.35 + depth * 0.58,
      depth,
      phase: unit(index, 8) * Math.PI * 2,
      variant: index % 3,
    };
  });
}

function makeSprite(season: Exclude<BossSeason, "summer">, variant: number): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = 72;
  sprite.height = 72;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  context.translate(36, 36);

  if (season === "winter") {
    const alpha = variant === 0 ? 0.9 : variant === 1 ? 0.72 : 0.58;
    context.strokeStyle = `rgba(245, 252, 255, ${alpha})`;
    context.lineWidth = variant === 2 ? 2 : 2.8;
    context.lineCap = "round";
    context.shadowColor = "rgba(180, 225, 255, .75)";
    context.shadowBlur = 8;
    for (let arm = 0; arm < 6; arm += 1) {
      context.save();
      context.rotate((Math.PI / 3) * arm);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, -25);
      context.moveTo(0, -14);
      context.lineTo(-6, -20);
      context.moveTo(0, -14);
      context.lineTo(6, -20);
      context.stroke();
      context.restore();
    }
    context.fillStyle = "rgba(255,255,255,.95)";
    context.beginPath();
    context.arc(0, 0, 3, 0, Math.PI * 2);
    context.fill();
    return sprite;
  }

  context.shadowColor = season === "spring" ? "rgba(255, 168, 193, .38)" : "rgba(67, 24, 10, .35)";
  context.shadowBlur = 6;
  context.beginPath();
  if (season === "spring") {
    context.moveTo(0, -27);
    context.bezierCurveTo(22, -23, 27, -3, 4, 27);
    context.bezierCurveTo(-17, 19, -24, -5, 0, -27);
    const gradient = context.createLinearGradient(-18, -22, 20, 25);
    const palettes = [
      ["#fff8f6", "#f4a4bc", "#c9507d"],
      ["#fffdf8", "#efc4d0", "#db7596"],
      ["#ffe9ed", "#ee91ad", "#bb3f6d"],
    ];
    const palette = palettes[variant];
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.58, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "rgba(128, 45, 72, .3)";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(-1, -20);
    context.quadraticCurveTo(2, 1, 3, 20);
    context.stroke();
  } else {
    context.moveTo(0, -30);
    context.bezierCurveTo(9, -22, 24, -15, 19, -2);
    context.bezierCurveTo(30, 5, 18, 17, 7, 17);
    context.bezierCurveTo(4, 28, -10, 29, -10, 16);
    context.bezierCurveTo(-23, 14, -29, 1, -17, -6);
    context.bezierCurveTo(-24, -18, -8, -21, 0, -30);
    const palettes = [
      ["#ffd964", "#d27421", "#77241b"],
      ["#f2b243", "#b64322", "#602019"],
      ["#e46b2d", "#9c2d21", "#501b18"],
    ];
    const palette = palettes[variant];
    const gradient = context.createLinearGradient(-20, -25, 20, 25);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.55, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "rgba(76, 25, 16, .58)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -24);
    context.lineTo(-1, 28);
    context.moveTo(-1, -2);
    context.lineTo(-14, -11);
    context.moveTo(-1, 5);
    context.lineTo(13, -6);
    context.stroke();
  }
  return sprite;
}

function resetParticle(particle: SeasonParticle, season: BossSeason, width: number, height: number, index: number): void {
  particle.x = unit(index, performance.now() * 0.0001) * width + (season === "summer" ? width * 0.12 : 0);
  particle.y = -particle.size - unit(index, 13) * height * 0.22;
  particle.phase += 0.8;
}

function createAtmosphere(context: CanvasRenderingContext2D, season: BossSeason, height: number): CanvasGradient {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  if (season === "spring") {
    gradient.addColorStop(0, "rgba(151, 49, 77, .075)");
    gradient.addColorStop(1, "rgba(255, 191, 205, .018)");
  } else if (season === "summer") {
    gradient.addColorStop(0, "rgba(38, 80, 96, .13)");
    gradient.addColorStop(1, "rgba(5, 21, 31, .12)");
  } else if (season === "autumn") {
    gradient.addColorStop(0, "rgba(151, 62, 20, .08)");
    gradient.addColorStop(1, "rgba(75, 25, 13, .045)");
  } else {
    gradient.addColorStop(0, "rgba(184, 224, 239, .075)");
    gradient.addColorStop(1, "rgba(18, 39, 55, .065)");
  }
  return gradient;
}

function drawAtmosphere(context: CanvasRenderingContext2D, gradient: CanvasGradient, width: number, height: number, scene: SeasonScene): void {
  context.globalAlpha = 0.72 + scene.haze * 0.28;
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;

  if (scene.flash > 0.01) {
    context.fillStyle = `rgba(225, 246, 255, ${scene.flash * 0.34})`;
    context.fillRect(0, 0, width, height);
  }
}

function configureSeasonTimeline(season: BossSeason, scene: SeasonScene) {
  const timeline = createTimeline({ loop: true, defaults: { ease: "inOut(2)" } });
  if (season === "summer") {
    timeline
      .add(scene, { gust: 0.18, haze: 0.35, flash: 0, duration: 2_800 })
      .add(scene, { gust: 0.92, haze: 0.75, flash: 1, duration: 85, ease: "out(4)" })
      .add(scene, { gust: 0.42, flash: 0.12, duration: 130 })
      .add(scene, { flash: 0.72, duration: 70 })
      .add(scene, { gust: 0.16, haze: 0.25, flash: 0, duration: 3_100 });
  } else {
    timeline
      .add(scene, { gust: 0.08, haze: 0.2, duration: 1_900 })
      .add(scene, { gust: season === "winter" ? 0.72 : 1, haze: 0.76, duration: 1_150, ease: "out(3)" })
      .add(scene, { gust: 0.2, haze: 0.28, duration: 3_300 });
  }
  return timeline;
}

export function BossSeasonOverlay({ season }: { season: BossSeason | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !season || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const scene: SeasonScene = { gust: 0.12, flash: 0, haze: 0.2 };
    const timeline = configureSeasonTimeline(season, scene);
    const sprites = season === "summer"
      ? []
      : [0, 1, 2].map((variant) => makeSprite(season, variant));
    let width = 1;
    let height = 1;
    let particles: SeasonParticle[] = [];
    let atmosphere = createAtmosphere(context, season, height);
    let frameId = 0;
    let resizeFrameId = 0;
    let previousTime = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      particles = createParticles(season, width, height);
      atmosphere = createAtmosphere(context, season, height);
    };

    // Mobile Safari updates the visual viewport before every CSS layout box has
    // settled after a rotation. ResizeObserver catches the final box, while the
    // visual viewport listener gives the canvas an immediate correctly scaled
    // frame instead of briefly stretching the previous orientation.
    const scheduleResize = () => {
      window.cancelAnimationFrame(resizeFrameId);
      resizeFrameId = window.requestAnimationFrame(resize);
    };

    const draw = (time: number) => {
      const delta = Math.min(0.034, Math.max(0.001, (time - previousTime) / 1_000));
      previousTime = time;
      context.clearRect(0, 0, width, height);
      drawAtmosphere(context, atmosphere, width, height, scene);

      particles.forEach((particle, index) => {
        const wave = Math.sin(time * 0.0012 + particle.phase) * (8 + 26 * particle.depth);
        const gust = scene.gust * (season === "summer" ? -180 : 62) * particle.depth;
        particle.x += (particle.vx + gust + wave) * delta;
        particle.y += particle.vy * (0.78 + scene.gust * 0.38) * delta;
        particle.rotation += particle.spin * delta;

        if (particle.y > height + particle.size * 2 || particle.x < -width * 0.25 || particle.x > width * 1.25) {
          resetParticle(particle, season, width, height, index);
        }

        if (season === "summer") {
          const length = particle.size * (0.72 + scene.gust * 0.38);
          context.globalAlpha = particle.opacity * 0.7;
          context.strokeStyle = "rgb(202, 235, 247)";
          context.lineWidth = 0.7 + particle.depth * 1.25;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x + length * 0.2, particle.y - length);
          context.stroke();
          if (particle.y > height * 0.9 && index % 7 === 0) {
            const splashOpacity = Math.min(0.42, Math.max(0, (particle.y / height - 0.9) * 4.2));
            context.globalAlpha = splashOpacity;
            context.strokeStyle = "rgb(190, 229, 244)";
            context.lineWidth = 1;
            context.beginPath();
            context.ellipse(particle.x, height - 3, particle.size * 0.22, particle.size * 0.06, 0, 0, Math.PI * 2);
            context.stroke();
          }
          context.globalAlpha = 1;
          return;
        }

        const sprite = sprites[particle.variant];
        if (!sprite) return;
        const scaleX = season === "winter"
          ? 0.75 + particle.depth * 0.42
          : Math.max(0.25, Math.abs(Math.cos(time * 0.0017 + particle.phase)));
        context.save();
        context.globalAlpha = particle.opacity;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.scale(scaleX, 1);
        context.drawImage(sprite, -particle.size / 2, -particle.size / 2, particle.size, particle.size);
        context.restore();
      });
      frameId = window.requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.visualViewport?.addEventListener("resize", scheduleResize);
    resize();
    frameId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(resizeFrameId);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      resizeObserver.disconnect();
      timeline.revert();
    };
  }, [season]);

  if (!season) return null;
  return (
    <div className={`boss-season-fx boss-season-fx--${season}`} data-season={season} aria-hidden="true">
      <canvas className="boss-season-fx__canvas" ref={canvasRef} />
    </div>
  );
}
