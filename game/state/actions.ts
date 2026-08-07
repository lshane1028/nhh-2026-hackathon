import type { ExperimentalRules, ScreenId } from "../types";

export type GameAction =
  | { type: "HYDRATE"; payload: unknown }
  | { type: "SET_SEED"; seed: string }
  | { type: "OPEN_DECK_SELECT" }
  | { type: "START_RUN"; startDeckId: string; tutorialMode: boolean }
  | { type: "CONTINUE_RUN"; state: import("../types").GameState }
  | { type: "TOGGLE_EXPERIMENT"; key: keyof ExperimentalRules }
  | { type: "START_STAGE" }
  | { type: "SELECT_CARD"; cardId: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "ASSIGN_CUP_ROLE"; cardId: string; role: "animal" | "double_chaff" }
  | { type: "SUBMIT_HAND" }
  | { type: "DISCARD_SELECTED" }
  | { type: "DECLARE_GO" }
  | { type: "STOP_ROUND" }
  | { type: "CONTINUE_AFTER_REWARD" }
  | { type: "BUY_OFFER"; offerId: string }
  | { type: "REROLL_SHOP" }
  | { type: "PICK_PACK_CARD"; instanceId: string }
  | { type: "CLOSE_PACK" }
  | { type: "SELECT_CONSUMABLE_TARGET"; cardId: string }
  | { type: "APPLY_CONSUMABLE"; option?: string }
  | { type: "CANCEL_CONSUMABLE" }
  | { type: "SELL_TALISMAN"; instanceId: string }
  | { type: "MOVE_TALISMAN"; instanceId: string; direction: -1 | 1 }
  | { type: "CHOOSE_CONTRACT"; contractId: string }
  | { type: "OPEN_SCREEN"; screen: ScreenId }
  | { type: "RETURN_TO_PLAY" }
  | { type: "RETRY_NAGARI" }
  | { type: "RETRY_TUTORIAL_BOSS" }
  | { type: "NEXT_STAGE" }
  | { type: "CONTINUE_INFINITE" }
  | { type: "RESET_RUN" };
