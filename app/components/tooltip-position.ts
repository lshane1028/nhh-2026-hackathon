export interface FloatingHintPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

export interface FloatingHintAnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

/** Places a fixed, body-level tooltip entirely inside the visible viewport. */
export function getFloatingHintPosition(
  rect: FloatingHintAnchorRect,
  viewportWidth: number,
  viewportHeight: number,
  tooltipWidth: number,
  tooltipHeight: number,
): FloatingHintPosition {
  const margin = 12;
  const gap = 10;
  const width = Math.min(tooltipWidth, Math.max(0, viewportWidth - margin * 2));
  const height = Math.min(tooltipHeight, Math.max(0, viewportHeight - margin * 2));
  const minimumLeft = margin + width / 2;
  const maximumLeft = Math.max(minimumLeft, viewportWidth - margin - width / 2);
  const availableBelow = viewportHeight - margin - rect.bottom - gap;
  const availableAbove = rect.top - gap - margin;
  const placement = availableBelow >= height || availableBelow >= availableAbove
    ? "below"
    : "above";
  const preferredTop = placement === "below"
    ? rect.bottom + gap
    : rect.top - gap - height;
  const maximumTop = Math.max(margin, viewportHeight - margin - height);

  return {
    left: Math.min(maximumLeft, Math.max(minimumLeft, rect.left + rect.width / 2)),
    top: Math.min(maximumTop, Math.max(margin, preferredTop)),
    placement,
  };
}
