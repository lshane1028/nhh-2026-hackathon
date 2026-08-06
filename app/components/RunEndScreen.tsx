"use client";

import type { RunStats, YakuId } from "@/game/types";

import { AssetPlaceholder } from "./AssetPlaceholder";
import "./screen-ui.css";

export interface RunEndYakuStat {
  yakuId: YakuId | string;
  name: string;
  count: number;
  assetTag: string;
}

export interface RunEndScreenProps {
  assetTag: string;
  result: "win" | "lose";
  title?: string;
  summary?: string;
  failureReason?: string;
  stageLabel: string;
  finalScore: number;
  targetScore?: number;
  money: number;
  seed: string;
  stats: RunStats;
  yakuStats?: readonly RunEndYakuStat[];
  onRestart: () => void;
  onReturnToTitle?: () => void;
  onCopySeed?: () => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function RunEndScreen({
  assetTag,
  result,
  title,
  summary,
  failureReason,
  stageLabel,
  finalScore,
  targetScore,
  money,
  seed,
  stats,
  yakuStats,
  onRestart,
  onReturnToTitle,
  onCopySeed,
  className,
}: RunEndScreenProps) {
  const won = result === "win";
  const heading = title ?? (won ? "꽃판 완주!" : "이번 판은 나가리");
  const goRate =
    stats.goAttempts > 0
      ? Math.round((stats.goSuccesses / stats.goAttempts) * 100)
      : 0;
  const displayedYakus =
    yakuStats ??
    Object.entries(stats.yakusPlayed)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([yakuId, count]) => ({
        yakuId,
        name: yakuId,
        count,
        assetTag: `${assetTag}:yaku:${yakuId}`,
      }));

  return (
    <main
      className={joinClassNames(
        "run-end-screen",
        won ? "run-end-screen--win" : "run-end-screen--lose",
        className,
      )}
      data-result={result}
    >
      <header className="run-end-screen__hero">
        <AssetPlaceholder
          assetTag={assetTag}
          label={won ? "승리 결과" : "패배 결과"}
          description={stageLabel}
          tone={won ? "score" : "boss"}
        />
        <p>{won ? "RUN COMPLETE" : "RUN OVER"}</p>
        <h1>{heading}</h1>
        {summary ? <span>{summary}</span> : null}
        {!won && failureReason ? (
          <strong className="run-end-screen__failure">패배 원인 · {failureReason}</strong>
        ) : null}
      </header>

      <section className="run-end-screen__score" aria-label="최종 점수">
        <span>{stageLabel}</span>
        <strong>{formatNumber(finalScore)}</strong>
        <small>최종 확정 점수</small>
        {typeof targetScore === "number" ? (
          <p>
            목표 {formatNumber(targetScore)}점 · {finalScore >= targetScore ? "달성" : `${formatNumber(targetScore - finalScore)}점 부족`}
          </p>
        ) : null}
      </section>

      <section className="run-end-screen__stats" aria-labelledby="run-stats-title">
        <div className="screen-section-heading">
          <div>
            <p>RUN STATS</p>
            <h2 id="run-stats-title">이번 런 기록</h2>
          </div>
          <span>{formatNumber(money)}냥 보유</span>
        </div>
        <dl>
          <div><dt>제출한 손</dt><dd>{formatNumber(stats.handsPlayed)}</dd></div>
          <div><dt>사용한 버리기</dt><dd>{formatNumber(stats.discardsUsed)}</dd></div>
          <div><dt>고 도전</dt><dd>{formatNumber(stats.goAttempts)}</dd></div>
          <div><dt>고 성공</dt><dd>{formatNumber(stats.goSuccesses)}</dd></div>
          <div><dt>고 실패</dt><dd>{formatNumber(stats.goFailures)}</dd></div>
          <div><dt>고 성공률</dt><dd>{goRate}%</dd></div>
          <div><dt>최고 한 손</dt><dd>{formatNumber(stats.highestHand)}</dd></div>
          <div><dt>번 돈</dt><dd>{formatNumber(stats.moneyEarned)}냥</dd></div>
        </dl>
      </section>

      <section className="run-end-screen__yakus" aria-labelledby="run-yaku-title">
        <div className="screen-section-heading">
          <div>
            <p>YAKU RECORD</p>
            <h2 id="run-yaku-title">자주 낸 끗패</h2>
          </div>
          <span>{displayedYakus.length}종</span>
        </div>
        {displayedYakus.length > 0 ? (
          <div className="run-end-screen__yaku-grid">
            {displayedYakus.map((item) => (
              <article key={item.yakuId}>
                <AssetPlaceholder
                  assetTag={item.assetTag}
                  label={item.name}
                  description={`${formatNumber(item.count)}회`}
                  tone="collection"
                  compact
                />
                <strong>{formatNumber(item.count)}회</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="run-end-screen__empty">기록된 끗패가 없습니다.</p>
        )}
      </section>

      <section className="run-end-screen__seed" aria-label="재현 시드">
        <span>재현 시드</span>
        <code>{seed}</code>
        {onCopySeed ? (
          <button type="button" onClick={onCopySeed}>시드 복사</button>
        ) : null}
      </section>

      <footer className="run-end-screen__actions">
        <button
          type="button"
          className="screen-button screen-button--primary"
          onClick={onRestart}
        >
          같은 설정으로 다시 시작
        </button>
        {onReturnToTitle ? (
          <button type="button" className="screen-button" onClick={onReturnToTitle}>
            제목 화면
          </button>
        ) : null}
      </footer>
    </main>
  );
}

