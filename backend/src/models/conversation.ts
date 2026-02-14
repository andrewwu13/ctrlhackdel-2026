// ── Conversation Models ────────────────────────────────────────────

/**
 * State machine for agent-to-agent conversations.
 * INIT → LIVE (0–180s) → WRAP (170–180s) → SCORE
 */
export enum ConversationState {
  INIT = "INIT",
  LIVE = "LIVE",
  WRAP = "WRAP",
  SCORE = "SCORE",
}

export interface Message {
  id: string;
  sessionId: string;
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  timestamp: Date;

  // Telemetry fields (populated by scoring/telemetry service)
  sentiment?: number;          // -1 to 1
  topicEmbedding?: number[];
  tokenCount?: number;
}

export interface ConversationSession {
  id: string;
  userAId: string;
  userBId: string;
  state: ConversationState;
  messages: Message[];
  startedAt: Date;
  endedAt?: Date;

  // Elapsed seconds
  elapsedSeconds: number;
}
