"use client";

export interface GameTopBarProps {
  assetTag: string;
  title?: string;
  stageLabel: string;
  roundLabel?: string;
  bossLabel?: string | null;
  targetScore: number;
  confirmedScore: number;
  potScore: number;
  successfulGoCount: number;
  handsRemaining: number;
  discardsRemaining: number;
  money: number;
  seed?: string;
  onOpenDeck?: () => void;
  onOpenRules?: () => void;
  onRestart?: () => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function GameTopBar({
  assetTag,
  title = "꽃판: GO!",
  stageLabel,
  roundLabel,
  bossLabel,
  targetScore,
  confirmedScore,
  potScore,
  successfulGoCount,
  handsRemaining,
  discardsRemaining,
  money,
  seed,
  onOpenDeck,
  onOpenRules,
  onRestart,
  className,
}: GameTopBarProps) {
  return (
    <header
      className={joinClassNames(
        "game-top-bar",
        Boolean(bossLabel) && "game-top-bar--boss",
        className,
      )}
      data-asset-tag={assetTag}
    >
      <div className="game-top-bar__identity">
        <strong className="game-top-bar__title">{title}</strong>
        <span className="game-top-bar__stage">{stageLabel}</span>
        {roundLabel ? (
          <span className="game-top-bar__round">{roundLabel}</span>
        ) : null}
        {bossLabel ? (
          <span className="game-top-bar__boss">우두머리 · {bossLabel}</span>
        ) : null}
      </div>

      <dl className="game-top-bar__scores" aria-label="현재 점수">
        <div>
          <dt>목표</dt>
          <dd>{formatNumber(targetScore)}</dd>
        </div>
        <div>
          <dt>누적 점수</dt>
          <dd>{formatNumber(confirmedScore)}</dd>
        </div>
        <div className="game-top-bar__pot">
          <dt>이번 승부</dt>
          <dd>{formatNumber(potScore)}</dd>
          <small>{successfulGoCount}고</small>
        </div>
      </dl>

      <dl className="game-top-bar__resources" aria-label="남은 자원">
        <div>
          <dt>낼 기회</dt>
          <dd>{handsRemaining}</dd>
        </div>
        <div>
          <dt>버리기</dt>
          <dd>{discardsRemaining}</dd>
        </div>
        <div>
          <dt>냥</dt>
          <dd>{money}</dd>
        </div>
      </dl>

      {onOpenDeck || onOpenRules || onRestart ? (
        <nav className="game-top-bar__actions" aria-label="게임 메뉴">
          {onOpenDeck ? (
            <button type="button" onClick={onOpenDeck}>
              덱
            </button>
          ) : null}
          {onOpenRules ? (
            <button type="button" onClick={onOpenRules}>
              규칙
            </button>
          ) : null}
          {onRestart ? (
            <button type="button" onClick={onRestart}>
              재시작
            </button>
          ) : null}
        </nav>
      ) : null}

      <div className="game-top-bar__meta" aria-label="플레이 정보">
        <code>{assetTag}</code>
        {seed ? <code>SEED {seed}</code> : null}
      </div>
    </header>
  );
}
