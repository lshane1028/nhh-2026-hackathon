"use client";

import type { StartDeckDefinition } from "@/game/types";

import "./screen-ui.css";

export interface TitleScreenProps {
  assetTag: string;
  title?: string;
  subtitle?: string;
  description: string;
  versionLabel?: string;
  startDecks: readonly StartDeckDefinition[];
  selectedStartDeckId: string;
  unlockedStartDeckIds: readonly string[];
  canContinue: boolean;
  continueSummary?: string;
  newGameLabel?: string;
  continueLabel?: string;
  skipTutorialLabel?: string;
  onSelectStartDeck: (deckId: string) => void;
  onNewGame: () => void;
  onSkipTutorial: () => void;
  onContinue?: () => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function TitleScreen({
  assetTag,
  title = "꽃판: GO!",
  subtitle = "열두 달, 끝까지 판을 키워라",
  description,
  versionLabel,
  startDecks,
  selectedStartDeckId,
  unlockedStartDeckIds,
  canContinue,
  continueSummary,
  newGameLabel = "새 게임",
  continueLabel = "이어하기",
  skipTutorialLabel = "튜토리얼 없이 시작",
  onSelectStartDeck,
  onNewGame,
  onSkipTutorial,
  onContinue,
  className,
}: TitleScreenProps) {
  return (
    <main className={joinClassNames("title-screen", className)}>
      <header className="title-screen__hero">
        <div className="title-screen__hero-art" data-asset-tag={assetTag} aria-label={`${title} 대표 이미지`}>
          <span className="title-screen__moon" aria-hidden="true" />
          <div className="title-screen__card-fan" aria-hidden="true">
            <span className="title-screen__hero-card title-screen__hero-card--pine" />
            <span className="title-screen__hero-card title-screen__hero-card--cherry" />
            <span className="title-screen__hero-card title-screen__hero-card--moon" />
          </div>
          <div className="title-screen__hero-seal" aria-hidden="true">花</div>
          <p>패를 고르고 짓을 맞춰<br />열두 달을 버텨라</p>
        </div>
        <div className="title-screen__intro">
          <p className="title-screen__eyebrow">열두 달 화투 덱빌딩</p>
          <h1>{title}</h1>
          <p className="title-screen__subtitle">{subtitle}</p>
          <p className="title-screen__description">{description}</p>
          {versionLabel ? (
            <code className="title-screen__version">{versionLabel}</code>
          ) : null}
        </div>
      </header>

      <section className="title-screen__panel title-screen__decks" aria-label="시작 덱 선택">
        <header>
          <strong>시작 덱</strong>
          <span>3·6·9·12월을 처음 넘길 때 새 덱이 열립니다.</span>
        </header>
        <div className="title-screen__deck-grid">
          {startDecks.map((deck) => {
            const unlocked = unlockedStartDeckIds.includes(deck.id);
            const selected = selectedStartDeckId === deck.id;
            return (
              <button
                type="button"
                key={deck.id}
                disabled={!unlocked}
                aria-pressed={selected}
                className={joinClassNames("title-screen__deck", selected && "title-screen__deck--selected")}
                data-deck-id={deck.id}
                onClick={() => onSelectStartDeck(deck.id)}
              >
                <span className="title-screen__deck-back" aria-hidden="true" />
                <b>{deck.name}</b>
                <small>{unlocked ? deck.description : `${deck.unlockStage}월 클리어 시 해금`}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="title-screen__launch" aria-label="게임 시작">
        <div className="title-screen__selection-summary" aria-live="polite">
          <span>시작 구성</span>
          <strong>{startDecks.find((deck) => deck.id === selectedStartDeckId)?.name ?? "정석패"}</strong>
          <small>{startDecks.find((deck) => deck.id === selectedStartDeckId)?.description ?? "기본 화투 48장"}</small>
        </div>
        <div className="title-screen__launch-actions">
          <button
            type="button"
            className="screen-button screen-button--primary"
            onClick={onNewGame}
          >
            {newGameLabel}
          </button>
          <button
            type="button"
            className="screen-button screen-button--skip"
            onClick={onSkipTutorial}
          >
            {skipTutorialLabel}
            <small>1월부터 완전 무작위</small>
          </button>
          <button
            type="button"
            className="screen-button"
            disabled={!canContinue || !onContinue}
            onClick={onContinue}
          >
            {continueLabel}
            {continueSummary ? <small>{continueSummary}</small> : null}
          </button>
        </div>
      </section>
    </main>
  );
}

