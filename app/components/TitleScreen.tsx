"use client";

import type {
  ExperimentalRules,
  StartDeckDefinition,
} from "@/game/types";

import { AssetPlaceholder } from "./AssetPlaceholder";
import "./screen-ui.css";

export type ExperimentalRuleKey = keyof ExperimentalRules;

export interface ExperimentalRuleOption {
  id: ExperimentalRuleKey;
  label: string;
  description: string;
  assetTag: string;
  disabled?: boolean;
}

export interface TitleScreenProps {
  assetTag: string;
  title?: string;
  subtitle?: string;
  description: string;
  versionLabel?: string;
  startDecks: readonly StartDeckDefinition[];
  selectedDeckId: string | null;
  experimentalRules: ExperimentalRules;
  experimentalRuleOptions: readonly ExperimentalRuleOption[];
  canContinue: boolean;
  continueSummary?: string;
  newGameLabel?: string;
  continueLabel?: string;
  onSelectDeck: (deckId: string) => void;
  onToggleExperimentalRule: (
    rule: ExperimentalRuleKey,
    enabled: boolean,
  ) => void;
  onNewGame: () => void;
  onContinue?: () => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function TitleScreen({
  assetTag,
  title = "꽃판: GO!",
  subtitle = "열두 달을 고쳐 만드는 고·스톱 덱빌더",
  description,
  versionLabel,
  startDecks,
  selectedDeckId,
  experimentalRules,
  experimentalRuleOptions,
  canContinue,
  continueSummary,
  newGameLabel = "새 게임",
  continueLabel = "이어하기",
  onSelectDeck,
  onToggleExperimentalRule,
  onNewGame,
  onContinue,
  className,
}: TitleScreenProps) {
  const selectedDeck = startDecks.find((deck) => deck.id === selectedDeckId);

  return (
    <main className={joinClassNames("title-screen", className)}>
      <header className="title-screen__hero">
        <AssetPlaceholder
          assetTag={assetTag}
          label={title}
          description={subtitle}
          tone="neutral"
          className="title-screen__hero-asset"
        />
        <div className="title-screen__intro">
          <p className="title-screen__eyebrow">TEXT-ONLY PROTOTYPE</p>
          <h1>{title}</h1>
          <p className="title-screen__subtitle">{subtitle}</p>
          <p className="title-screen__description">{description}</p>
          {versionLabel ? (
            <code className="title-screen__version">{versionLabel}</code>
          ) : null}
        </div>
      </header>

      <section className="title-screen__panel" aria-labelledby="start-deck-title">
        <div className="screen-section-heading">
          <div>
            <p>STEP 1</p>
            <h2 id="start-deck-title">시작 덱 선택</h2>
          </div>
          <span aria-label={`시작 덱 ${startDecks.length}종`}>
            {startDecks.length}/10종
          </span>
        </div>

        <div className="title-screen__deck-grid" role="group" aria-label="시작 덱 목록">
          {startDecks.map((deck, index) => {
            const selected = deck.id === selectedDeckId;

            return (
              <button
                type="button"
                key={deck.id}
                className={joinClassNames(
                  "title-screen__deck",
                  selected && "title-screen__deck--selected",
                )}
                aria-pressed={selected}
                onClick={() => onSelectDeck(deck.id)}
              >
                <span className="title-screen__deck-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <AssetPlaceholder
                  assetTag={deck.assetTag}
                  label={deck.name}
                  description={deck.effectKey}
                  tone="card"
                  compact
                />
                <span className="title-screen__deck-description">
                  {deck.description}
                </span>
                <span className="title-screen__deck-state" aria-hidden="true">
                  {selected ? "선택됨" : "이 덱 선택"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <fieldset className="title-screen__panel title-screen__experiments">
        <legend>
          <span>STEP 2</span>
          실험 규칙
        </legend>
        <p className="title-screen__hint">
          기본 규칙을 익힌 뒤 켜는 선택 기능입니다. 각 설정은 새 런에만 반영됩니다.
        </p>
        <div className="title-screen__rule-grid">
          {experimentalRuleOptions.map((option) => {
            const enabled = experimentalRules[option.id];

            return (
              <button
                type="button"
                role="switch"
                key={option.id}
                className={joinClassNames(
                  "title-screen__rule",
                  enabled && "title-screen__rule--enabled",
                )}
                aria-checked={enabled}
                disabled={option.disabled}
                onClick={() =>
                  onToggleExperimentalRule(option.id, !enabled)
                }
              >
                <AssetPlaceholder
                  assetTag={option.assetTag}
                  label={option.label}
                  description={enabled ? "켜짐" : "꺼짐"}
                  tone="neutral"
                  compact
                />
                <span>{option.description}</span>
                <strong aria-hidden="true">{enabled ? "ON" : "OFF"}</strong>
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="title-screen__launch" aria-label="게임 시작">
        <div className="title-screen__selection-summary" aria-live="polite">
          <span>선택한 시작 덱</span>
          <strong>{selectedDeck?.name ?? "덱을 선택하세요"}</strong>
          {selectedDeck ? <code>{selectedDeck.assetTag}</code> : null}
        </div>
        <div className="title-screen__launch-actions">
          <button
            type="button"
            className="screen-button screen-button--primary"
            disabled={!selectedDeckId}
            onClick={onNewGame}
          >
            {newGameLabel}
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

