import { v4 as uuidv4 } from "uuid";
import { AgentEngine } from "./agent-engine";
import { ScoringEngine } from "./scoring-engine";
import type { ConversationSession, Message } from "../models/conversation";
import { ConversationState } from "../models/conversation";
import type { ProfileVector } from "../models/user";
import type { CompatibilityResult } from "../models/compatibility";

// ── Constants ──────────────────────────────────────────────────────

const TOTAL_DURATION_SECONDS = 180;
const WRAP_START_SECONDS = 170;
const TURN_INTERVAL_MS = 6000; // ~6s per agent turn

// ── Match Orchestrator ─────────────────────────────────────────────

export interface MatchCallbacks {
  onStateChange: (state: ConversationState) => void;
  onAgentMessage: (message: Message) => void;
  onCompatibilityUpdate: (score: number, breakdown: Record<string, number>) => void;
  onTimerTick: (elapsedSeconds: number) => void;
  onConversationEnd: (result: CompatibilityResult) => void;
}

export class MatchOrchestrator {
  private agentA: AgentEngine;
  private agentB: AgentEngine;
  private scoringEngine: ScoringEngine;
  private session: ConversationSession;
  private timer: ReturnType<typeof setInterval> | null = null;
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: MatchCallbacks;

  constructor(
    profileA: ProfileVector,
    profileSummaryA: string,
    profileB: ProfileVector,
    profileSummaryB: string,
    callbacks: MatchCallbacks
  ) {
    this.agentA = new AgentEngine();
    this.agentB = new AgentEngine();
    this.scoringEngine = new ScoringEngine();
    this.callbacks = callbacks;

    // Initialize agents with their respective profiles
    this.agentA.initialize(profileA, profileSummaryA);
    this.agentB.initialize(profileB, profileSummaryB);

    // Initialize scoring with both profile vectors
    this.scoringEngine.initialize(profileA, profileB);

    // Create session
    this.session = {
      id: uuidv4(),
      userAId: profileA.userId,
      userBId: profileB.userId,
      state: ConversationState.INIT,
      messages: [],
      startedAt: new Date(),
      elapsedSeconds: 0,
    };
  }

  /**
   * Start the conversation lifecycle.
   */
  async start(): Promise<void> {
    // ── INIT state ──────────────────────────────────────────────
    this.transitionTo(ConversationState.INIT);

    // Compute pre-conversation score
    this.scoringEngine.computePreConversationScore();

    // ── Transition to LIVE ──────────────────────────────────────
    this.transitionTo(ConversationState.LIVE);

    // Start the countdown timer (ticks every second)
    this.timer = setInterval(() => {
      this.session.elapsedSeconds++;
      this.callbacks.onTimerTick(this.session.elapsedSeconds);

      // State transitions based on elapsed time
      if (
        this.session.elapsedSeconds >= WRAP_START_SECONDS &&
        this.session.state === ConversationState.LIVE
      ) {
        this.transitionTo(ConversationState.WRAP);
      }

      if (this.session.elapsedSeconds >= TOTAL_DURATION_SECONDS) {
        this.end();
      }
    }, 1000);

    // Start alternating agent turns
    let isAgentATurn = true;
    const openingMessage = "Hey! Nice to meet you. I've been looking forward to this.";

    // Agent A opens
    await this.handleAgentTurn(this.agentA, "agent_a", openingMessage, true);

    this.turnTimer = setInterval(async () => {
      if (this.session.state === ConversationState.SCORE) {
        if (this.turnTimer) clearInterval(this.turnTimer);
        return;
      }

      const lastMessage =
        this.session.messages[this.session.messages.length - 1];
      const currentAgent = isAgentATurn ? this.agentA : this.agentB;
      const sender = isAgentATurn ? "agent_a" : "agent_b";

      await this.handleAgentTurn(
        currentAgent,
        sender as "agent_a" | "agent_b",
        lastMessage?.content || "",
        false
      );

      isAgentATurn = !isAgentATurn;
    }, TURN_INTERVAL_MS);
  }

  /**
   * Handle a single agent turn: generate response, score it, emit events.
   */
  private async handleAgentTurn(
    agent: AgentEngine,
    sender: "agent_a" | "agent_b",
    inputMessage: string,
    isOpening: boolean
  ): Promise<void> {
    const state =
      this.session.state === ConversationState.WRAP ? "WRAP" : "LIVE";

    const content = isOpening
      ? inputMessage
      : await agent.generateResponse(inputMessage, state);

    const message: Message = {
      id: uuidv4(),
      sessionId: this.session.id,
      sender,
      content,
      timestamp: new Date(),
    };

    // Add to both agents' memory
    this.agentA.addToHistory(message);
    this.agentB.addToHistory(message);
    this.session.messages.push(message);

    // Emit message
    this.callbacks.onAgentMessage(message);

    // Update scores
    const scoreUpdate = await this.scoringEngine.updateScore(message);
    this.callbacks.onCompatibilityUpdate(
      scoreUpdate.compatibilityScore,
      scoreUpdate.breakdown as unknown as Record<string, number>
    );
  }

  /**
   * End the conversation and produce final results.
   */
  private end(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.turnTimer) clearInterval(this.turnTimer);

    this.transitionTo(ConversationState.SCORE);

    this.session.endedAt = new Date();

    const finalResult = this.scoringEngine.computeFinalResult(this.session.id);
    this.callbacks.onConversationEnd(finalResult);
  }

  private transitionTo(state: ConversationState): void {
    this.session.state = state;
    this.callbacks.onStateChange(state);
  }

  getSession(): ConversationSession {
    return { ...this.session };
  }
}
