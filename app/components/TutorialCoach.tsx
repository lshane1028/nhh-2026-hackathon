"use client";

import "./screen-ui.css";

export interface TutorialCoachProps {
  step: number;
  total: number;
  title: string;
  body: string;
  actionHint: string;
  targetLabel?: string;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function TutorialCoach({
  step,
  total,
  title,
  body,
  actionHint,
  targetLabel,
  className,
}: TutorialCoachProps) {
  const safeTotal = Math.max(1, total);
  const safeStep = Math.min(Math.max(1, step), safeTotal);

  return (
    <aside
      className={joinClassNames("tutorial-coach", className)}
      aria-label={`초보자 안내 ${safeTotal}단계 중 ${safeStep}단계: ${title}`}
    >
      <div className="tutorial-coach__meta">
        <strong>첫 플레이 길잡이</strong>
        <span aria-label={`${safeTotal}단계 중 ${safeStep}단계`}>
          {safeStep} / {safeTotal}
        </span>
      </div>

      <div className="tutorial-coach__content">
        <div className="tutorial-coach__about">
          <span>이건 무엇?</span>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>

        <div className="tutorial-coach__action">
          <span>이번에는 무엇을 클릭?</span>
          <strong>{actionHint}</strong>
          {targetLabel ? <small>찾을 곳 · {targetLabel}</small> : null}
        </div>
      </div>

      <progress
        className="tutorial-coach__progress"
        value={safeStep}
        max={safeTotal}
        aria-label="튜토리얼 진행률"
      />
    </aside>
  );
}
