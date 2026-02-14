"use client";

import RadarChart from "@/components/RadarChart";
import CompatibilityMeter from "@/components/CompatibilityMeter";
import type { ScoreBreakdown } from "@/lib/types";
import styles from "./page.module.css";

// TODO: Get actual result from router state or API
const DEMO_BREAKDOWN: ScoreBreakdown = {
  preConversation: 72,
  personality: 68,
  flow: 81,
  topic: 75,
};

const DEMO_SCORE = 74;

export default function MatchSummaryPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🎉 Match Summary</h1>
      </header>

      <div className={styles.content}>
        <div className={styles.scoreSection}>
          <CompatibilityMeter score={DEMO_SCORE} label="Overall Compatibility" />

          <div className={styles.verdict}>
            {DEMO_SCORE >= 65 ? (
              <p className={styles.match}>It&apos;s a Match! 💘</p>
            ) : (
              <p className={styles.noMatch}>Maybe Next Time 💫</p>
            )}
          </div>
        </div>

        <div className={styles.chartSection}>
          <h2>Score Breakdown</h2>
          <RadarChart breakdown={DEMO_BREAKDOWN} />
        </div>

        <div className={styles.detailsSection}>
          <h2>Breakdown</h2>
          <div className={styles.detailGrid}>
            <div className={styles.detailCard}>
              <span className={styles.detailLabel}>Profile Match</span>
              <span className={styles.detailValue}>{DEMO_BREAKDOWN.preConversation}%</span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailLabel}>Personality</span>
              <span className={styles.detailValue}>{DEMO_BREAKDOWN.personality}%</span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailLabel}>Chemistry</span>
              <span className={styles.detailValue}>{DEMO_BREAKDOWN.flow}%</span>
            </div>
            <div className={styles.detailCard}>
              <span className={styles.detailLabel}>Shared Interests</span>
              <span className={styles.detailValue}>{DEMO_BREAKDOWN.topic}%</span>
            </div>
          </div>
        </div>

        <div className={styles.ctaSection}>
          <button className={styles.planDateBtn}>📅 Plan a Date</button>
          <button className={styles.tryAgainBtn}>Try Another Match</button>
        </div>
      </div>
    </div>
  );
}
