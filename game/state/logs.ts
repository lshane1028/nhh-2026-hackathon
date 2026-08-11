import type { GameState, RoundLogEntry } from "../types";

export function prependGameLog(
  state: GameState,
  kind: RoundLogEntry["kind"],
  title: string,
  detail: string,
): RoundLogEntry[] {
  const id = `${state.runId}:${state.stage}:${state.rngCursor}:${state.logs.length}`;
  return [{ id, kind, title, detail }, ...state.logs].slice(0, 18);
}
