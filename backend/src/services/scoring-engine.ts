import type { ProfileVector } from "../models/user";
import type { Message } from "../models/conversation";
import {
  type CompatibilityResult,
  type ScoreBreakdown,
  SCORE_WEIGHTS,
  EMA_ALPHA,
} from "../models/compatibility";
import { CompatibilityResultModel } from "../db/mongo";

// ── Scoring Engine ─────────────────────────────────────────────────

export class ScoringEngine {
  private profileA: ProfileVector | null = null;
  private profileB: ProfileVector | null = null;

  // Running scores
  private preConversationScore = 0;
  private hardConstraintPassed = false;
  private personalityScore = 0;
  private flowScore = 0;
  private topicScore = 0;
  private smoothedScore = 0;
  private trendOverTime: number[] = [];

  // Telemetry accumulators
  private sentimentTrendA: number[] = [];
  private sentimentTrendB: number[] = [];
  private messageLengthsA: number[] = [];
  private messageLengthsB: number[] = [];
  private topicEmbeddingsA: number[][] = [];
  private topicEmbeddingsB: number[][] = [];
  private messageCount = 0;

  initialize(profileA: ProfileVector, profileB: ProfileVector): void {
    this.profileA = profileA;
    this.profileB = profileB;
  }

  // ── Pre-conversation Score (30%) ────────────────────────────────

  computePreConversationScore(): void {
    if (!this.profileA || !this.profileB) return;

    // Cosine similarity between profile embeddings
    this.preConversationScore = this.cosineSimilarity(
      this.profileA.embedding,
      this.profileB.embedding
    );

    // Hard constraint filtering (boolean gate)
    this.hardConstraintPassed = this.checkHardConstraints(
      this.profileA.hardFilters,
      this.profileB.hardFilters
    );
  }

  // ── Per-message Score Update ─────────────────────────────────────

  async updateScore(
    message: Message
  ): Promise<{ compatibilityScore: number; breakdown: ScoreBreakdown }> {
    this.messageCount++;

    // ── Personality alignment (20%) ─────────────────────────────
    if (this.profileA && this.profileB) {
      const pA = Object.values(this.profileA.personality);
      const pB = Object.values(this.profileB.personality);
      this.personalityScore = this.cosineSimilarity(pA, pB);
    }

    // ── Emotional + conversational flow (25%) ───────────────────
    const sentiment = message.sentiment ?? 0;
    const msgLength = message.content.length;

    if (message.sender === "agent_a") {
      this.sentimentTrendA.push(sentiment);
      this.messageLengthsA.push(msgLength);
    } else {
      this.sentimentTrendB.push(sentiment);
      this.messageLengthsB.push(msgLength);
    }

    // Sentiment alignment: how similar are their sentiment trends?
    const sentimentAlignment = this.computeSentimentAlignment();

    // Message length balance: ratio of average message lengths
    const lengthBalance = this.computeLengthBalance();

    this.flowScore = sentimentAlignment * 0.6 + lengthBalance * 0.4;

    // ── Topic alignment (20%) ───────────────────────────────────
    if (message.topicEmbedding && message.topicEmbedding.length > 0) {
      if (message.sender === "agent_a") {
        this.topicEmbeddingsA.push(message.topicEmbedding);
      } else {
        this.topicEmbeddingsB.push(message.topicEmbedding);
      }

      // Compute cross-agent topic similarity (latest embeddings)
      if (this.topicEmbeddingsA.length > 0 && this.topicEmbeddingsB.length > 0) {
        const latestA = this.topicEmbeddingsA[this.topicEmbeddingsA.length - 1];
        const latestB = this.topicEmbeddingsB[this.topicEmbeddingsB.length - 1];
        const crossSimilarity = this.cosineSimilarity(latestA, latestB);

        // Use EMA to smooth topic score over time
        this.topicScore = 0.4 * crossSimilarity + 0.6 * this.topicScore;
      }
    }

    // ── Aggregate weighted score ────────────────────────────────
    const rawScore =
      SCORE_WEIGHTS.preConversation * this.preConversationScore +
      SCORE_WEIGHTS.personality * this.personalityScore +
      SCORE_WEIGHTS.flow * this.flowScore +
      SCORE_WEIGHTS.topic * this.topicScore;

    const scaledScore = Math.round(rawScore * 100);

    // EMA smoothing
    this.smoothedScore =
      EMA_ALPHA * scaledScore + (1 - EMA_ALPHA) * this.smoothedScore;

    // Update every 2-3 messages
    if (this.messageCount % 2 === 0) {
      this.trendOverTime.push(Math.round(this.smoothedScore));
    }

    const breakdown: ScoreBreakdown = {
      preConversation: Math.round(this.preConversationScore * 100),
      personality: Math.round(this.personalityScore * 100),
      flow: Math.round(this.flowScore * 100),
      topic: Math.round(this.topicScore * 100),
    };

    return {
      compatibilityScore: Math.round(this.smoothedScore),
      breakdown,
    };
  }

  // ── Final Result ────────────────────────────────────────────────

  async computeFinalResult(sessionId: string): Promise<CompatibilityResult> {
    const finalScore = Math.round(this.smoothedScore);

    const result: CompatibilityResult = {
      sessionId,
      compatibilityScore: finalScore,
      breakdown: {
        preConversation: Math.round(this.preConversationScore * 100),
        personality: Math.round(this.personalityScore * 100),
        flow: Math.round(this.flowScore * 100),
        topic: Math.round(this.topicScore * 100),
      },
      hardConstraintPassed: this.hardConstraintPassed,
      trendOverTime: this.trendOverTime,
      recommendMatch: finalScore >= 65 && this.hardConstraintPassed,
      computedAt: new Date(),
    };

    // Persist to MongoDB
    await CompatibilityResultModel.create(result);
    console.log(`[ScoringEngine] Saved CompatibilityResult for session ${sessionId} (score: ${finalScore})`);

    return result;
  }

  // ── Utility Functions ───────────────────────────────────────────

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private checkHardConstraints(
    filtersA: Record<string, string | boolean>,
    filtersB: Record<string, string | boolean>
  ): boolean {
    // Both users must pass each other's hard filters
    for (const key of Object.keys(filtersA)) {
      if (key in filtersB && filtersA[key] !== filtersB[key]) {
        return false;
      }
    }
    return true;
  }

  private computeSentimentAlignment(): number {
    if (this.sentimentTrendA.length === 0 || this.sentimentTrendB.length === 0)
      return 0.5;

    const avgA =
      this.sentimentTrendA.reduce((s, v) => s + v, 0) /
      this.sentimentTrendA.length;
    const avgB =
      this.sentimentTrendB.reduce((s, v) => s + v, 0) /
      this.sentimentTrendB.length;

    // Alignment = 1 - normalized difference
    return 1 - Math.abs(avgA - avgB) / 2;
  }

  private computeLengthBalance(): number {
    if (this.messageLengthsA.length === 0 || this.messageLengthsB.length === 0)
      return 0.5;

    const avgA =
      this.messageLengthsA.reduce((s, v) => s + v, 0) /
      this.messageLengthsA.length;
    const avgB =
      this.messageLengthsB.reduce((s, v) => s + v, 0) /
      this.messageLengthsB.length;

    const ratio = Math.min(avgA, avgB) / Math.max(avgA, avgB);
    return ratio; // 1.0 = perfectly balanced
  }
}
