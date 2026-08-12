"use client";

import type { RunStats, YakuId } from "@/game/types";
import { getYakuAssetTag, getYakuDisplayName } from "@/game/content/yaku";
import type { RunIdentityTag } from "@/game/state/run-identity";

import { AssetPlaceholder } from "./AssetPlaceholder";
import { HwatuCard } from "./HwatuCard";
import { RunIdentityStrip } from "./RunIdentityStrip";
import "./screen-ui.css";
import "./run-end-screen.css";

export interface RunEndYakuStat {
  yakuId: YakuId | string;
  name: string;
  count: number;
  assetTag: string;
}

export interface RunEndOwnedYaku {
  yakuId: YakuId | string;
  name: string;
  level: number;
  assetTag: string;
}

export interface RunEndOwnedTalisman {
  instanceId: string;
  name: string;
  description: string;
  assetTag: string;
  growth: number;
}

export interface RunEndForbiddenStat {
  definitionId: string;
  name: string;
  description: string;
  assetTag: string;
  count: number;
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
  ownedYakus?: readonly RunEndOwnedYaku[];
  ownedTalismans?: readonly RunEndOwnedTalisman[];
  usedForbiddens?: readonly RunEndForbiddenStat[];
  buildTags?: readonly RunIdentityTag[];
  onRestart: () => void;
  onReturnToTitle?: () => void;
  onCopySeed?: () => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
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
  ownedYakus = [],
  ownedTalismans = [],
  usedForbiddens = [],
  buildTags = [],
  onRestart,
  onReturnToTitle,
  onCopySeed,
  className,
}: RunEndScreenProps) {
  const won = result === "win";
  const heading = title ?? (won ? "경화수월 완주!" : "이번 판은 나가리");
  const displayedYakus =
    yakuStats ??
    Object.entries(stats.yakusPlayed)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1])
      .map(([yakuId, count]) => ({
        yakuId,
        name: getYakuDisplayName(yakuId),
        count,
        assetTag: getYakuAssetTag(yakuId) ?? `${assetTag}:yaku:${yakuId}`,
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
        <p>{won ? "열두 달 완주" : "도전 종료"}</p>
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

      <section className="run-end-screen__best-hand" aria-labelledby="run-best-hand-title">
        <div className="screen-section-heading">
          <div>
            <p>최고 기록</p>
            <h2 id="run-best-hand-title">가장 높았던 손패</h2>
          </div>
          <span>{stats.highestHandYakuId ? getYakuDisplayName(stats.highestHandYakuId) : "기록 없음"}</span>
        </div>
        <div className="run-end-screen__best-hand-body">
          <div className="run-end-screen__best-cards" aria-label="최고 점수 손패 카드">
            {stats.highestHandCards.length > 0
              ? stats.highestHandCards.map((card) => <HwatuCard dense card={card} key={card.instanceId} />)
              : <p className="run-end-screen__empty">기록된 손패가 없습니다.</p>}
          </div>
          <div className="run-end-screen__best-score">
            <span>최고 손패 점수</span>
            <strong>{formatNumber(stats.highestHand)}</strong>
            <small>점</small>
          </div>
        </div>
      </section>

      <section className="run-end-screen__stats" aria-labelledby="run-stats-title">
        <div className="screen-section-heading">
          <div>
            <p>판 기록</p>
            <h2 id="run-stats-title">이번 판 기록</h2>
          </div>
          <span>{formatNumber(money)}냥 보유</span>
        </div>
        <dl>
          <div><dt>제출한 손</dt><dd>{formatNumber(stats.handsPlayed)}</dd></div>
          <div><dt>사용한 버리기</dt><dd>{formatNumber(stats.discardsUsed)}</dd></div>
          <div><dt>최고 한 손</dt><dd>{formatNumber(stats.highestHand)}</dd></div>
          <div><dt>최다 제출</dt><dd>{formatNumber(stats.highestSubmissionCards)}장</dd></div>
          <div><dt>번 돈</dt><dd>{formatNumber(stats.moneyEarned)}냥</dd></div>
        </dl>
      </section>

      {buildTags.length > 0 ? (
        <section className="run-end-screen__build" aria-labelledby="run-build-title">
          <div className="screen-section-heading">
            <div>
              <p>덱 결산</p>
              <h2 id="run-build-title">완성한 덱의 방향</h2>
            </div>
            <span>{buildTags.length}가지 특징</span>
          </div>
          <RunIdentityStrip tags={buildTags} />
        </section>
      ) : null}

      <section className="run-end-screen__yakus" aria-labelledby="run-yaku-title">
        <div className="screen-section-heading">
          <div>
            <p>족보 기록</p>
            <h2 id="run-yaku-title">이번 판에 낸 족보</h2>
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
          <p className="run-end-screen__empty">기록된 족보가 없습니다.</p>
        )}
      </section>

      <section className="run-end-screen__owned-yakus" aria-labelledby="run-owned-yaku-title">
        <div className="screen-section-heading">
          <div>
            <p>비결서 기록</p>
            <h2 id="run-owned-yaku-title">보유했던 족보</h2>
          </div>
          <span>{ownedYakus.length}종</span>
        </div>
        {ownedYakus.length > 0 ? (
          <div className="run-end-screen__owned-yaku-grid">
            {ownedYakus.map((item) => (
              <article key={item.yakuId}>
                <AssetPlaceholder
                  assetTag={item.assetTag}
                  label={item.name}
                  description={`레벨 ${formatNumber(item.level)}`}
                  tone="collection"
                  compact
                />
                <strong>Lv.{formatNumber(item.level)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="run-end-screen__empty">이번 판에서 강화한 족보가 없습니다.</p>
        )}
      </section>

      <section className="run-end-screen__owned-talismans" aria-labelledby="run-owned-talisman-title">
        <div className="screen-section-heading">
          <div>
            <p>부적 기록</p>
            <h2 id="run-owned-talisman-title">보유했던 부적</h2>
          </div>
          <span>{ownedTalismans.length}개</span>
        </div>
        {ownedTalismans.length > 0 ? (
          <div className="run-end-screen__owned-talisman-grid">
            {ownedTalismans.map((item) => (
              <article key={item.instanceId}>
                <AssetPlaceholder
                  assetTag={item.assetTag}
                  label={item.name}
                  description={item.description}
                  tone="collection"
                  compact
                />
                {item.growth > 0 ? <strong>성장 +{formatNumber(item.growth)}</strong> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="run-end-screen__empty">마지막까지 보유한 부적이 없습니다.</p>
        )}
      </section>

      <section className="run-end-screen__used-forbiddens" aria-labelledby="run-used-forbidden-title">
        <div className="screen-section-heading">
          <div>
            <p>금단서 기록</p>
            <h2 id="run-used-forbidden-title">사용한 금단서</h2>
          </div>
          <span>{usedForbiddens.reduce((sum, item) => sum + item.count, 0)}회</span>
        </div>
        {usedForbiddens.length > 0 ? (
          <div className="run-end-screen__used-forbidden-grid">
            {usedForbiddens.map((item) => (
              <article key={item.definitionId}>
                <AssetPlaceholder
                  assetTag={item.assetTag}
                  label={item.name}
                  description={item.description}
                  tone="boss"
                  compact
                />
                <strong>{formatNumber(item.count)}회 사용</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="run-end-screen__empty">이번 판에서 사용한 금단서가 없습니다.</p>
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

