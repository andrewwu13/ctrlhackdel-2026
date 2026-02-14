// ── Compatibility / Scoring Models ─────────────────────────────────

export interface ScoreBreakdown {
  /** Cosine similarity between profile embeddings + hard filter gate (30%) */
  preConversation: number;

  /** Big-5 personality vector similarity (20%) */
  personality: number;

  /** Sentiment alignment + latency + message balance (25%) */
  flow: number;

  /** Topic embedding overlap + shared interest emergence (20%) */
  topic: number;
}

export interface CompatibilityResult {
  sessionId: string;

  /** Weighted final score, 0–100 */
  compatibilityScore: number;

  /** Component breakdown */
  breakdown: ScoreBreakdown;

  /** Did both users pass all hard constraints? */
  hardConstraintPassed: boolean;

  /** Score at each update tick (for UI trend graph) */
  trendOverTime: number[];

  /** Should we recommend this match? */
  recommendMatch: boolean;

  computedAt: Date;
}

// ── Weights (from AGENTS.md) ──────────────────────────────────────

export const SCORE_WEIGHTS = {
  preConversation: 0.30,
  personality: 0.25,
  flow: 0.25,
  topic: 0.20,
} as const;

/** Exponential moving average alpha for smoothed score updates */
export const EMA_ALPHA = 0.3;
