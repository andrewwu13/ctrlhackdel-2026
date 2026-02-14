import type { Message } from "../models/conversation";

// ── Telemetry Data ─────────────────────────────────────────────────

export interface MessageTelemetry {
  messageId: string;
  sessionId: string;
  timestamp: Date;
  sender: string;
  tokenCount: number;
  sentiment: number;
  topicEmbedding: number[];
  responseLatencyMs?: number;
}

// ── Telemetry Service ──────────────────────────────────────────────

export class TelemetryService {
  private logs: Map<string, MessageTelemetry[]> = new Map();

  /**
   * Capture telemetry for a single message.
   */
  capture(message: Message, responseLatencyMs?: number): MessageTelemetry {
    const telemetry: MessageTelemetry = {
      messageId: message.id,
      sessionId: message.sessionId,
      timestamp: message.timestamp,
      sender: message.sender,
      tokenCount: message.tokenCount ?? this.estimateTokens(message.content),
      sentiment: message.sentiment ?? 0,
      topicEmbedding: message.topicEmbedding ?? [],
      responseLatencyMs,
    };

    // Store per-session
    const sessionLogs = this.logs.get(message.sessionId) ?? [];
    sessionLogs.push(telemetry);
    this.logs.set(message.sessionId, sessionLogs);

    return telemetry;
  }

  /**
   * Get all telemetry for a session.
   */
  getSessionTelemetry(sessionId: string): MessageTelemetry[] {
    return this.logs.get(sessionId) ?? [];
  }

  /**
   * Rough token estimate (~4 chars per token).
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
