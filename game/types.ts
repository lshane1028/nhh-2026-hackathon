export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type Season = "spring" | "summer" | "autumn" | "winter";
export type CardKind = "bright" | "animal" | "ribbon" | "chaff";
export type RibbonGroup = "hong" | "cho" | "cheong" | "rain";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export type EnhancementId =
  | "inked"
  | "scarlet"
  | "wild"
  | "glass"
  | "steel"
  | "stone"
  | "coin"
  | "fortune";

export type EditionId = "gold_leaf" | "mother_of_pearl" | "five_color" | "engraved";
export type SealId = "yellow" | "red" | "blue" | "purple";

export interface CardTemplate {
  originId: string;
  name: string;
  month: Month;
  monthName: string;
  kind: CardKind;
  ribbonGroup?: RibbonGroup;
  chaffValue: 0 | 1 | 2;
  tags: string[];
  assetTag: string;
}

export interface CardInstance extends Omit<CardTemplate, "month" | "kind" | "ribbonGroup" | "chaffValue" | "tags"> {
  instanceId: string;
  month: Month;
  kind: CardKind;
  ribbonGroup?: RibbonGroup;
  chaffValue: 0 | 1 | 2;
  tags: string[];
  permanentKkeutBonus: number;
  enhancement?: EnhancementId;
  edition?: EditionId;
  seal?: SealId;
  disabledForRound?: boolean;
  /**
   * Label only — see game/content/card-effects.ts. The scoring engine does not
   * read this yet, so a tagged card behaves exactly like a plain one.
   */
  effectTagId?: string;
}

/** 끗패 족보. The 짓 contributes the 월 합, these contribute the 배수. */
export type ImmediateYakuId =
  | "mangtong"
  | "kkeut"
  | "gabo"
  | "seryuk"
  | "jangsa"
  | "jangpping"
  | "gupping"
  | "doksa"
  | "ali"
  | "ttaeng"
  | "jangttaeng"
  | "gwangttaeng_13"
  | "gwangttaeng_18"
  | "gwangttaeng_38";

export type CollectionYakuId =
  | "hongdan"
  | "chodan"
  | "cheongdan"
  | "godori"
  | "rain_three_brights"
  | "three_brights"
  | "four_brights"
  | "five_brights";

export type YakuId = ImmediateYakuId | CollectionYakuId;

export interface ImmediateYakuDefinition {
  id: ImmediateYakuId;
  name: string;
  description: string;
  baseKkeut: number;
  baseHeung: number;
  growthKkeut: number;
  growthHeung: number;
  assetTag: string;
  secret?: boolean;
}

export interface CollectionYakuDefinition {
  id: CollectionYakuId;
  name: string;
  description: string;
  completionKkeut: number;
  completionHeung: number;
  growthKkeut: number;
  growthHeung: number;
  required: number;
  assetTag: string;
}

export type ScoreEffectKey =
  | "season_cards_add_kkeut"
  | "kind_cards_add_kkeut"
  | "chaff_value_add_kkeut"
  | "exact_submit_add"
  | "exact_scoring_add"
  | "yaku_add_heung"
  | "jit_add_heung"
  | "collection_add_heung"
  | "bird_retrigger"
  | "double_chaff_boost"
  | "five_multiple_jit"
  | "empty_slots_add_heung"
  | "money_add_heung"
  | "all_cards_score_bonus"
  | "all_distinct_months_add"
  | "jit_size_add"
  // 짓고땡용 조커 키. 대부분 "다른 카드가 있어야 값이 생기는" 종류라,
  // 손에 남긴 패·남은 버리기·이미 가진 부적·이번 런 기록을 읽는다.
  | "held_cards_add_heung"
  | "held_kind_multiply_heung"
  | "discards_left_add_kkeut"
  | "talisman_value_add_heung"
  | "full_slots_multiply_heung"
  | "fresh_yaku_multiply_heung"
  | "yaku_multiply_kkeut"
  | "yaku_multiply_heung"
  | "jit_sum_multiply_heung"
  | "bright_drought_growth"
  | "devour_neighbor"
  | "copy_left_score"
  | "cup_dual_role"
  | "month_counts_as_bright"
  | "first_card_retrigger"
  | "burn_chaff_growth"
  | "month_diversity_multiplier"
  | "go_chain_multiplier"
  | "borrow_yaku_level"
  | "unify_month_once"
  | "all_kind_wild"
  | "score_then_burn"
  | "copy_neighbors"
  | "threshold_relief"
  | "settlement_multiplier"
  | "fail_rescue"
  | "economy";

export interface TalismanDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  weight: number;
  effectKey: ScoreEffectKey;
  amount?: number;
  factor?: number;
  params?: Record<string, string | number | boolean>;
  assetTag: string;
}

export type PainterEffectKey =
  | "month_plus"
  | "month_minus"
  | "copy_month"
  | "unify_two_months"
  | "duplicate"
  | "burn"
  | "promote_kind"
  | "double_chaff"
  | "ribbon_dye"
  | "bird_mark"
  | "rain_mark"
  | "apply_enhancement"
  | "apply_edition"
  | "apply_seal"
  | "repeat_last_consumable";

export interface PainterDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  weight: number;
  effectKey: PainterEffectKey;
  minTargets: number;
  maxTargets: number;
  assetTag: string;
}

export type ForbiddenEffectKey =
  | "all_to_january"
  | "double_duplicate_hand_penalty"
  | "make_bright_pay"
  | "all_hand_chaff_bonus"
  | "wild_month_zero_base"
  | "random_burn_for_money"
  | "engrave_talisman_hand_penalty"
  | "level_all_money_zero"
  | "sacrifice_copy"
  | "legendary_destroy_others";

export type ForbiddenTargetKind = "card" | "talisman" | "none";

export interface ForbiddenDefinition {
  id: string;
  name: string;
  description: string;
  benefit: string;
  cost: string;
  price: number;
  /** What the player selects before this one-shot effect resolves. */
  targetKind: ForbiddenTargetKind;
  minTargets: number;
  maxTargets: number;
  targetPrompt: string;
  /** A ritual fee paid on use in addition to the shop price. */
  additionalCost?: number;
  effectKey: ForbiddenEffectKey;
  assetTag: string;
}

export interface BookDefinition {
  id: string;
  name: string;
  yakuId: YakuId;
  price: number;
  rarity: Rarity;
  weight: number;
  assetTag: string;
}

export interface CardModifierDefinition<T extends string> {
  id: T;
  name: string;
  description: string;
  assetTag: string;
}

export interface BossDefinition {
  id: string;
  name: string;
  description: string;
  ruleKey:
    | "first_card_zero"
    | "no_rain"
    | "dry_bright"
    | "bright_zero"
    | "first_ribbon_disabled"
    | "popular_month_weak"
    | "discard_tax"
    | "two_face_down"
    | "requires_go"
    | "go_fail_tax"
    | "reverse_runs"
    | "zero_go_reduced";
  counterplay: string;
  assetTag: string;
}

export interface StartDeckDefinition {
  id: string;
  name: string;
  description: string;
  effectKey: string;
  assetTag: string;
}

export interface PackDefinition {
  id: string;
  name: string;
  description: string;
  category: "card" | "painter" | "book" | "talisman" | "forbidden";
  price: number;
  choices: number;
  picks: number;
  assetTag: string;
}

export interface ContractDefinition {
  id: string;
  name: string;
  description: string;
  upgradedName: string;
  upgradedDescription: string;
  effectKey: string;
  assetTag: string;
}

export type WeatherId = "clear" | "rain" | "wind" | "snow";

export interface WeatherDefinition {
  id: WeatherId;
  name: string;
  description: string;
  assetTag: string;
}

export interface YakuCandidate {
  yakuId: ImmediateYakuId;
  /** Everything submitted — 짓 and 끗패 both score and both get collected. */
  scoringCardIds: string[];
  /** The cards forming the 짓. Empty when only a 끗패 was played. */
  jitCardIds: string[];
  /** Month sum of the 짓, always a multiple of ten. 0 for a bare 끗패. */
  jitSum: number;
  label: string;
  /** Rank on top of the family base, e.g. 9끗 over plain 끗. */
  rankBonusHeung?: number;
  rankLabel?: string;
}

export interface CollectionProgress {
  yakuId: CollectionYakuId;
  matchedCardIds: string[];
  required: number;
  completed: boolean;
}

export interface ScoreOperation {
  sourceId: string;
  label: string;
  operation: "add_kkeut" | "add_heung" | "multiply_heung" | "set_kkeut";
  value: number;
  runningKkeut: number;
  runningHeung: number;
}

export interface ScoreBreakdown {
  yakuId: ImmediateYakuId;
  yakuName: string;
  scoringCardIds: string[];
  /** The 짓 half of the split. The rest of `scoringCardIds` is the 끗패. */
  jitCardIds: string[];
  /** 월 합 the 짓 contributed. 0 for a bare two-card 끗패. */
  jitSum: number;
  /** "9끗" / "6땡" when the family covers a range of ranks. */
  rankLabel?: string;
  newCollectionYakuIds: CollectionYakuId[];
  startingKkeut: number;
  startingHeung: number;
  finalKkeut: number;
  finalHeung: number;
  score: number;
  operations: ScoreOperation[];
}

export interface CollectionState {
  cardIds: string[];
  completedYakuIds: CollectionYakuId[];
}

export interface MasteryEvent {
  yakuId: YakuId;
  amount: number;
  reason: "played" | "collection" | "go_collection_bonus";
}

/**
 * One round's running state. Go is a bet placed after the target is cleared,
 * so there is no pending/confirmed split and nothing is ever rolled back.
 */
export interface GoChainState {
  /** Submission score from Dori-jit-go-ttaeng hands. */
  submissionScore: number;
  /** Converted Go-Stop collection score. */
  collectionScore: number;
  /** submissionScore + collectionScore. */
  roundScore: number;
  /** How many times Go has been called this round, 0 to 3. */
  goCount: 0 | 1 | 2 | 3;
  /**
   * The bar locked in when Go was called. null before any Go, when the bar is
   * simply the stage target.
   */
  goRequirement: number | null;
  collection: CollectionState;
  mastery: MasteryEvent[];
}

export interface TalismanInstance {
  instanceId: string;
  definitionId: string;
  growth: number;
  edition?: EditionId;
}

export interface YakuLevelState {
  level: number;
  mastery: number;
}

export type ScreenId =
  | "title"
  | "deck_select"
  | "round_intro"
  | "play"
  | "decision"
  | "reward"
  | "shop"
  | "contract"
  | "deck_editor"
  | "codex"
  | "run_win"
  | "run_lose";

export interface PendingPack {
  packId: string;
  name: string;
  picksLeft: number;
  candidates: CardInstance[];
}

export interface ShopOffer {
  offerId: string;
  category: "talisman" | "painter" | "book" | "forbidden" | "pack";
  definitionId: string;
  price: number;
  sold: boolean;
}

export interface RoundLogEntry {
  id: string;
  kind: "score" | "go" | "bank" | "fail" | "system" | "reward";
  title: string;
  detail: string;
}

export interface ExperimentalRules {
  yardMatching: boolean;
  bakContracts: boolean;
  weather: boolean;
  nagariRetry: boolean;
}

export interface YardState {
  cards: CardInstance[];
  sweptCount: number;
}

export interface RunStats {
  handsPlayed: number;
  discardsUsed: number;
  goAttempts: number;
  goSuccesses: number;
  goFailures: number;
  highestHand: number;
  highestSubmissionCards: number;
  moneyEarned: number;
  yakusPlayed: Record<string, number>;
}

export interface RoundRewardReason {
  id: string;
  label: string;
  detail: string;
  amount?: number;
  multiplier?: number;
}

export interface RoundSummary {
  submissionScore: number;
  collectionScore: number;
  goStopPoints: number;
  totalScore: number;
  goCount: number;
  highestHand: number;
  highestSubmissionCards: number;
  collectionCardIds: string[];
  completedCollectionYakuIds: CollectionYakuId[];
  rewardReasons: RoundRewardReason[];
}

export interface CalendarStamp {
  month: Month;
  yakuId: YakuId;
  stage: number;
  assetTag: string;
}

export interface GameState {
  version: 1;
  screen: ScreenId;
  seed: string;
  rngCursor: number;
  runId: string;
  startDeckId: string | null;
  stage: number;
  infiniteLap: number;
  targetScore: number;
  bossId: string | null;
  weatherId: WeatherId;
  deck: CardInstance[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  usedPile: CardInstance[];
  selectedCardIds: string[];
  /** How the hand is laid out: by month, or grouped 광/동물/띠/피. */
  /**
   * Per-instance September cup roles. The player files each cup card onto the
   * collection board after scoring, so there is no round-wide cup role.
   */
  cupAssignments: Record<string, "animal" | "double_chaff">;
  /** Set while a submitted cup card is waiting for its collection choice. */
  pendingCupCardId: string | null;
  handsRemaining: number;
  discardsRemaining: number;
  handSize: number;
  baseHands: number;
  baseDiscards: number;
  targetMultiplier: number;
  roundSettlementBonus: number;
  failMoneyPenalty: number;
  roundSubmissionIndex: number;
  roundHighestHand: number;
  roundHighestSubmissionCards: number;
  roundTalismanUses: Record<string, number>;
  scoredMonthsThisRound: Month[];
  chain: GoChainState;
  money: number;
  talismans: TalismanInstance[];
  talismanSlots: number;
  yakuLevels: Record<string, YakuLevelState>;
  unlockedSecretYakuIds: ImmediateYakuId[];
  shopOffers: ShopOffer[];
  shopType: "talisman" | "painter" | "book" | "forbidden" | null;
  /** A bought card pack waiting for the player to take their picks. */
  pendingPack: PendingPack | null;
  rerollCost: number;
  pendingConsumableId: string | null;
  pendingTargetIds: string[];
  pendingShopOfferId: string | null;
  lastConsumableId: string | null;
  contracts: string[];
  contractChoices: string[];
  experimentalRules: ExperimentalRules;
  yard: YardState;
  nagariUsed: boolean;
  tutorialBossRetryUsed: boolean;
  tutorialMode: boolean;
  calendarStamps: CalendarStamp[];
  lastScore: ScoreBreakdown | null;
  lastRoundReward: number;
  lastRoundSummary: RoundSummary | null;
  returnScreen: ScreenId | null;
  logs: RoundLogEntry[];
  stats: RunStats;
}
