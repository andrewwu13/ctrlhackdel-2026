import { v4 as uuidv4 } from "uuid";
import { AgentEngine } from "./agent-engine";
import { ScoringEngine } from "./scoring-engine";
import { MessageEnrichmentService } from "./message-enrichment";
import type { ConversationSession, Message } from "../models/conversation";
import { ConversationState } from "../models/conversation";
import type { ProfileVector } from "../models/user";
import type { CompatibilityResult } from "../models/compatibility";
import { ConversationModel } from "../db/mongo";

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
  private enrichmentService: MessageEnrichmentService;
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
    this.enrichmentService = new MessageEnrichmentService();
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

    // Persist the conversation document to MongoDB
    await ConversationModel.create({
      _id: this.session.id,
      userAId: this.session.userAId,
      userBId: this.session.userBId,
      state: this.session.state,
      messages: [],
      startedAt: this.session.startedAt,
    });
    console.log(`[MatchOrchestrator] Created conversation ${this.session.id} in MongoDB`);

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

    // Enrich message with sentiment and topic embedding via Gemini
    await this.enrichmentService.enrich(message);

    this.session.messages.push(message);

    // Persist message to MongoDB
    await ConversationModel.findByIdAndUpdate(this.session.id, {
      $push: {
        messages: {
          id: message.id,
          sender: message.sender,
          content: message.content,
          timestamp: message.timestamp,
          sentiment: message.sentiment,
          topicEmbedding: message.topicEmbedding,
          tokenCount: message.tokenCount,
        },
      },
    });

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
  private async end(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.turnTimer) clearInterval(this.turnTimer);

    this.transitionTo(ConversationState.SCORE);

    this.session.endedAt = new Date();

    // Update conversation end state in MongoDB
    await ConversationModel.findByIdAndUpdate(this.session.id, {
      state: ConversationState.SCORE,
      endedAt: this.session.endedAt,
      elapsedSeconds: this.session.elapsedSeconds,
    });
    console.log(`[MatchOrchestrator] Conversation ${this.session.id} ended, saved to MongoDB`);

    const finalResult = await this.scoringEngine.computeFinalResult(this.session.id);
    this.callbacks.onConversationEnd(finalResult);
  }

  private transitionTo(state: ConversationState): void {
    this.session.state = state;
    this.callbacks.onStateChange(state);

    // Fire-and-forget state update to MongoDB
    ConversationModel.findByIdAndUpdate(this.session.id, { state }).catch(
      (err) => console.error(`[MatchOrchestrator] Failed to update state in MongoDB:`, err)
    );
  }

  /**
   * Public cleanup — stops timers without producing results.
   * Used when a client disconnects mid-conversation.
   */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.turnTimer) clearInterval(this.turnTimer);
    this.timer = null;
    this.turnTimer = null;
    console.log(`[MatchOrchestrator] Session ${this.session.id} stopped`);
  }

  getSession(): ConversationSession {
    return { ...this.session };
  }
}
