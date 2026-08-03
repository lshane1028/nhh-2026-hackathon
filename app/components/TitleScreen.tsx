"use client";

import type { ExperimentalRules } from "@/game/types";

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
  experimentalRules: ExperimentalRules;
  experimentalRuleOptions: readonly ExperimentalRuleOption[];
  canContinue: boolean;
  continueSummary?: string;
  newGameLabel?: string;
  continueLabel?: string;
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
  experimentalRules,
  experimentalRuleOptions,
  canContinue,
  continueSummary,
  newGameLabel = "새 게임",
  continueLabel = "이어하기",
  onToggleExperimentalRule,
  onNewGame,
  onContinue,
  className,
}: TitleScreenProps) {
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

      <fieldset className="title-screen__panel title-screen__experiments">
        <legend>
          <span>PLAY OPTIONS</span>
          선택 규칙
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
          <span>시작 구성</span>
          <strong>기본 화투 48장</strong>
          <code>deck:standard-48</code>
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

