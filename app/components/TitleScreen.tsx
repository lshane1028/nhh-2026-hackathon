"use client";

import type { StartDeckDefinition } from "@/game/types";

import "./screen-ui.css";
import "./title-screen.css";

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

const START_DECK_BACKS: Readonly<Record<string, string>> = {
  deck_standard: "/assets/generated/start-decks/standard.webp",
  deck_red: "/assets/generated/start-decks/red.webp",
  deck_blue: "/assets/generated/start-decks/blue.webp",
  deck_black: "/assets/generated/start-decks/black.webp",
  deck_money: "/assets/generated/start-decks/money.webp",
};

// The generated frame deliberately contains no lettering. Keeping the game name
// as real text makes the Korean wordmark sharp at every viewport size and keeps
// the page accessible to screen readers.
const GYEONGHWASUWOL_LOGO_BACKDROP = "/assets/generated/ui/gyeonghwasuwol-logo-backdrop.png";

export function TitleScreen({
  assetTag,
  title = "경화수월",
  subtitle = "화투패로 끗을 만들고 목표 점수를 넘기세요.",
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
      <header className="title-screen__hero" data-asset-tag={assetTag}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="title-screen__logo-backdrop" src={GYEONGHWASUWOL_LOGO_BACKDROP} alt="" aria-hidden="true" />
        <div className="title-screen__intro">
          <p className="title-screen__eyebrow">화투 덱빌딩 로그라이크</p>
          <h1 className="title-screen__logo">{title}</h1>
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
                <span className="title-screen__deck-back" aria-hidden="true">
                  {/* Generated card backs are project assets; native img keeps their exact 2:3 crop. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={START_DECK_BACKS[deck.id]} alt="" draggable={false} />
                </span>
                <b>{deck.name}</b>
                <small>{unlocked ? deck.description : `${deck.unlockStage}월 통과 시 개방`}</small>
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

