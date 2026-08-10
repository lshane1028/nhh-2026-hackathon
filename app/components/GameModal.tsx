"use client";

import type {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";

import { AssetPlaceholder } from "./AssetPlaceholder";

export interface GameModalAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  assetTag?: string;
}

export interface GameModalProps {
  id: string;
  open: boolean;
  assetTag: string;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: readonly GameModalAction[];
  onClose: () => void;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  dismissible?: boolean;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function GameModal({
  id,
  open,
  assetTag,
  title,
  description,
  children,
  actions = [],
  onClose,
  closeLabel = "닫기",
  closeOnBackdrop = true,
  dismissible = true,
  className,
}: GameModalProps) {
  if (!open) {
    return null;
  }

  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (dismissible && event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (dismissible && closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="game-modal__backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <section
        id={id}
        className={joinClassNames("game-modal", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="game-modal__header">
          <AssetPlaceholder
            assetTag={assetTag}
            label="모달"
            description={title}
            tone="neutral"
            compact
          />
          {dismissible ? (
            <button
              type="button"
              className="game-modal__close"
              onClick={onClose}
              aria-label={closeLabel}
              autoFocus
            >
              <span aria-hidden="true">×</span>
              <span className="game-modal__close-text">{closeLabel}</span>
            </button>
          ) : null}
        </header>

        <div className="game-modal__body">
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
          {children ? <div className="game-modal__content">{children}</div> : null}
        </div>

        {actions.length > 0 ? (
          <footer className="game-modal__actions">
            {actions.map((action) => (
              <button
                type="button"
                key={action.id}
                className={`game-modal__action game-modal__action--${action.variant ?? "secondary"}`}
                disabled={action.disabled}
                onClick={action.onClick}
                data-asset-tag={action.assetTag}
              >
                <span>{action.label}</span>
              </button>
            ))}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

