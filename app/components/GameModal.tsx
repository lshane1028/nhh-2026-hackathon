"use client";

import type {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { useEffect, useRef } from "react";

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

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const backdrop = backdropRef.current;
    const parent = backdrop?.parentElement;
    const inertStates = new Map<HTMLElement, boolean>();

    if (backdrop && parent) {
      for (const sibling of parent.children) {
        if (!(sibling instanceof HTMLElement) || sibling === backdrop) continue;
        inertStates.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }

    queueMicrotask(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const autofocus = dialog.querySelector<HTMLElement>("[autofocus]");
      const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (autofocus ?? firstFocusable ?? dialog).focus();
    });

    return () => {
      for (const [element, wasInert] of inertStates) element.inert = wasInert;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (dismissible && event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((element) => element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (dismissible && closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      className="game-modal__backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <section
        ref={dialogRef}
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

