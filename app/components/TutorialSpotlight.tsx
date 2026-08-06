"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

interface Layout {
  hole: Rect | null;
  callout: { top: number; left: number };
}

const HOLE_PADDING = 8;
const EDGE_MARGIN = 12;
const GAP = 14;

/**
 * Places the callout beside the hole, then clamps it into the viewport on both
 * axes using its real size. Without the clamp a highlight near an edge — the
 * collection rail especially — pushes the Next button off screen.
 */
function placeCallout(hole: Rect | null, size: { width: number; height: number }): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { width, height } = size;

  const clamp = (top: number, left: number) => ({
    top: Math.round(Math.min(Math.max(top, EDGE_MARGIN), Math.max(EDGE_MARGIN, vh - height - EDGE_MARGIN))),
    left: Math.round(Math.min(Math.max(left, EDGE_MARGIN), Math.max(EDGE_MARGIN, vw - width - EDGE_MARGIN))),
  });

  if (!hole) return clamp((vh - height) / 2, (vw - width) / 2);

  const roomBelow = vh - (hole.top + hole.height);
  const roomAbove = hole.top;
  const roomLeft = hole.left;
  const roomRight = vw - (hole.left + hole.width);
  const needed = height + GAP + EDGE_MARGIN;
  const neededSide = width + GAP + EDGE_MARGIN;

  if (roomBelow >= needed) return clamp(hole.top + hole.height + GAP, hole.left);
  if (roomAbove >= needed) return clamp(hole.top - height - GAP, hole.left);
  // Tall targets such as the collection rail: sit beside them instead.
  if (roomLeft >= neededSide) return clamp(hole.top, hole.left - width - GAP);
  if (roomRight >= neededSide) return clamp(hole.top, hole.left + hole.width + GAP);
  return clamp((vh - height) / 2, (vw - width) / 2);
}

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
  const calloutRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ hole: null, callout: { top: 0, left: 0 } });

  // One loop measures the target and positions the callout, so the two never
  // disagree and a moving target keeps its highlight.
  useLayoutEffect(() => {
    let frame = 0;
    let previous = "";

    const tick = () => {
      const node = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
      let hole: Rect | null = null;
      if (node) {
        const box = node.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) {
          hole = {
            top: box.top - HOLE_PADDING,
            left: box.left - HOLE_PADDING,
            width: box.width + HOLE_PADDING * 2,
            height: box.height + HOLE_PADDING * 2,
          };
        }
      }
      const calloutBox = calloutRef.current?.getBoundingClientRect();
      const callout = placeCallout(hole, {
        width: calloutBox?.width || 352,
        height: calloutBox?.height || 200,
      });

      const key = JSON.stringify({ hole, callout });
      if (key !== previous) {
        previous = key;
        setLayout({ hole, callout });
      }
      frame = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
    node?.classList.add("tutorial-target");
    return () => node?.classList.remove("tutorial-target");
  }, [target]);

  return (
    <div className="tutorial-spotlight" role="dialog" aria-modal="true" aria-label={title}>
      {layout.hole ? (
        <div
          className="tutorial-spotlight__hole"
          style={{
            top: layout.hole.top,
            left: layout.hole.left,
            width: layout.hole.width,
            height: layout.hole.height,
          }}
        />
      ) : (
        <div className="tutorial-spotlight__scrim" />
      )}

      <div
        ref={calloutRef}
        className="tutorial-spotlight__callout"
        style={{ top: layout.callout.top, left: layout.callout.left }}
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
