import type { ScoreBreakdown } from "@/game/types";

export interface ScoreFormulaProps {
  assetTag: string;
  breakdown?: ScoreBreakdown | null;
  label?: string;
  emptyMessage?: string;
  showOperations?: boolean;
  live?: "off" | "polite" | "assertive";
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2,
  }).format(value);
}

const OPERATION_LABELS = {
  add_kkeut: "월 합 +",
  add_heung: "배수 +",
  multiply_heung: "배수 ×",
  set_kkeut: "월 합 고정",
} as const;

export function ScoreFormula({
  assetTag,
  breakdown,
  label = "예상 점수",
  emptyMessage = "카드를 선택하면 계산식이 표시됩니다.",
  showOperations = true,
  live = "polite",
  className,
}: ScoreFormulaProps) {
  return (
    <section
      className={joinClassNames("score-formula", className)}
      aria-label={label}
      aria-live={live}
    >
      <header className="score-formula__header" data-asset-tag={assetTag}>
        <div>
          <span>점수 계산</span>
          <strong>{label}</strong>
        </div>
        <code>{assetTag}</code>
      </header>

      {!breakdown ? (
        <p className="score-formula__empty">{emptyMessage}</p>
      ) : (
        <>
          <div className="score-formula__heading">
            <span>메인 족보</span>
            <strong>{breakdown.yakuName}</strong>
          </div>

          <div className="score-formula__equation" aria-label="최종 점수 계산식">
            <span>
              <strong>{formatNumber(breakdown.finalKkeut)}</strong>
              <small>월 합</small>
            </span>
            <b aria-hidden="true">×</b>
            <span>
              <strong>{formatNumber(breakdown.finalHeung)}</strong>
              <small>배수</small>
            </span>
            <b aria-hidden="true">=</b>
            <span className="score-formula__total">
              <strong>{formatNumber(breakdown.score)}</strong>
              <small>점</small>
            </span>
          </div>

          <dl className="score-formula__summary">
            <div>
              <dt>족보 기본 배수</dt>
              <dd>× {formatNumber(breakdown.startingHeung)}</dd>
            </div>
            <div>
              <dt>득점 카드</dt>
              <dd>{breakdown.scoringCardIds.length}장</dd>
            </div>
            <div>
              <dt>이번에 완성</dt>
              <dd>{breakdown.newCollectionYakuIds.length}개</dd>
            </div>
          </dl>

          {showOperations && breakdown.operations.length > 0 ? (
            <ol className="score-formula__operations" aria-label="점수 계산 상세">
              {breakdown.operations.map((operation, index) => (
                <li key={`${operation.sourceId}-${index}`}>
                  <span className="score-formula__operation-label">
                    {operation.label}
                  </span>
                  <code>
                    {OPERATION_LABELS[operation.operation]} {formatNumber(operation.value)}
                  </code>
                  <span>
                    → 월 합 {formatNumber(operation.runningKkeut)} · ×
                    {formatNumber(operation.runningHeung)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}
