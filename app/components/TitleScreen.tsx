"use client";

import type { ExperimentalRules } from "@/game/types";

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
  experimentalRules: ExperimentalRules;
  experimentalRuleOptions: readonly ExperimentalRuleOption[];
  canContinue: boolean;
  continueSummary?: string;
  newGameLabel?: string;
  continueLabel?: string;
  skipTutorialLabel?: string;
  onToggleExperimentalRule: (
    rule: ExperimentalRuleKey,
    enabled: boolean,
  ) => void;
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
  experimentalRules,
  experimentalRuleOptions,
  canContinue,
  continueSummary,
  newGameLabel = "새 게임",
  continueLabel = "이어하기",
  skipTutorialLabel = "튜토리얼 없이 시작",
  onToggleExperimentalRule,
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
          <p className="title-screen__eyebrow">TWELVE MONTHS · ONE LAST BET</p>
          <h1>{title}</h1>
          <p className="title-screen__subtitle">{subtitle}</p>
          <p className="title-screen__description">{description}</p>
          {versionLabel ? (
            <code className="title-screen__version">{versionLabel}</code>
          ) : null}
        </div>
      </header>

      <fieldset className="title-screen__panel title-screen__experiments">
        <legend>
          <span>HOUSE RULES</span>
          선택 규칙
        </legend>
        <p className="title-screen__hint">
          기본 규칙을 익힌 뒤 켜는 선택 기능입니다. 각 설정은 새 런에만 반영됩니다.
        </p>
        <div className="title-screen__rule-grid">
          {experimentalRuleOptions.map((option, index) => {
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
                <span className="title-screen__rule-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="title-screen__rule-copy">
                  <b>{option.label}</b>
                  <small>{option.description}</small>
                </span>
                <span className="title-screen__rule-switch" aria-hidden="true">
                  <i />
                  <em>{enabled ? "사용" : "해제"}</em>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="title-screen__launch" aria-label="게임 시작">
        <div className="title-screen__selection-summary" aria-live="polite">
          <span>시작 구성</span>
          <strong>기본 화투 48장</strong>
          <small>열두 달 · 월마다 네 장</small>
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

