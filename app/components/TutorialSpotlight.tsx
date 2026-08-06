"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import "./screen-ui.css";

export interface TutorialSpotlightProps {
  /** Value of the target's `data-tutorial` attribute. */
  target: string;
  step: number;
  total: number;
  title: string;
  body: string;
  /** Shown on the button. Omit when the player must act on the highlight. */
  nextLabel?: string;
  /** Prompt shown instead of a button when the player must act. */
  actionHint?: string;
  onNext?: () => void;
  onSkip?: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

/**
 * Dims the screen and cuts a hole around one element, so only that element is
 * visible and clickable. The hole is a huge outward box-shadow rather than an
 * overlay with a gap, which keeps it to a single element and stays crisp while
 * the target moves.
 */
export function TutorialSpotlight({
  target,
  step,
  total,
  title,
  body,
  nextLabel,
  actionHint,
  onNext,
  onSkip,
}: TutorialSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    let frame = 0;

    const measure = () => {
      const node = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
      if (!node) {
        setRect(null);
      } else {
        const box = node.getBoundingClientRect();
        setRect({
          top: box.top - PADDING,
          left: box.left - PADDING,
          width: box.width + PADDING * 2,
          height: box.height + PADDING * 2,
        });
      }
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
    node?.classList.add("tutorial-target");
    return () => node?.classList.remove("tutorial-target");
  }, [target]);

  // Put the callout on whichever side of the hole has more room.
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const below = rect ? rect.top + rect.height : viewportHeight / 2;
  const placeBelow = !rect || below < viewportHeight * 0.55;

  return (
    <div className="tutorial-spotlight" role="dialog" aria-modal="true" aria-label={title}>
      {rect ? (
        <div
          className="tutorial-spotlight__hole"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="tutorial-spotlight__scrim" />
      )}

      <div
        className={`tutorial-spotlight__callout tutorial-spotlight__callout--${placeBelow ? "below" : "above"}`}
        style={rect
          ? placeBelow
            ? { top: rect.top + rect.height + 14, left: Math.max(12, Math.min(rect.left, (typeof window === "undefined" ? 1200 : window.innerWidth) - 360)) }
            : { bottom: viewportHeight - rect.top + 14, left: Math.max(12, Math.min(rect.left, (typeof window === "undefined" ? 1200 : window.innerWidth) - 360)) }
          : undefined}
      >
        <div className="tutorial-spotlight__meta">
          <strong>길잡이</strong>
          <span>{step} / {total}</span>
        </div>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="tutorial-spotlight__actions">
          {actionHint ? (
            <em className="tutorial-spotlight__hint">{actionHint}</em>
          ) : (
            <button type="button" className="tutorial-spotlight__next" onClick={onNext}>
              {nextLabel ?? "다음"}
            </button>
          )}
          {onSkip ? (
            <button type="button" className="tutorial-spotlight__skip" onClick={onSkip}>
              안내 끄기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
