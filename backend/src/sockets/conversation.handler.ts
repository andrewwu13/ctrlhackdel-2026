import { Namespace, Socket } from "socket.io";
import { MatchOrchestrator } from "../services/match-orchestrator";
import { ProfileBuilder } from "../services/profile-builder";
import type { MatchCallbacks } from "../services/match-orchestrator";

/**
 * Socket.IO handler for the /conversation namespace.
 * Streams the real-time agent-to-agent conversation to the client.
 *
 * Events:
 *   Server → Client:
 *     "agent_message"        — New message from an agent
 *     "compatibility_update" — Updated score + breakdown
 *     "state_change"         — Conversation state transition (INIT→LIVE→WRAP→SCORE)
 *     "timer_tick"           — Elapsed seconds update
 *     "conversation_end"     — Final results payload
 *     "error"                — Error message
 *
 *   Client → Server:
 *     "start"                — Client signals ready to begin
 */
export function registerConversationHandlers(namespace: Namespace): void {
  namespace.on("connection", (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string;
    const userAId = socket.handshake.query.userAId as string;
    const userBId = socket.handshake.query.userBId as string;

    if (!sessionId || !userAId || !userBId) {
      socket.emit("error", { message: "Missing required conversation params" });
      socket.disconnect();
      return;
    }

    console.log(`[Conversation] Client connected for session: ${sessionId}, users: ${userAId}, ${userBId}`);

    // Join a room for this session so multiple observers can watch
    socket.join(sessionId);

    let orchestrator: MatchOrchestrator | null = null;

    // ── Client signals ready ────────────────────────────────────
    socket.on("start", async () => {
      try {
        // Fetch profiles
        const profileA = await ProfileBuilder.getProfileVector(userAId);
        const profileB = await ProfileBuilder.getProfileVector(userBId);

        if (!profileA || !profileB) {
          socket.emit("error", {
            message: `Missing profile: ${!profileA ? userAId : userBId}`,
          });
          return;
        }

        // Build profile summaries
        const summaryA = `User ${userAId} - Openness: ${profileA.personality.openness}, Extraversion: ${profileA.personality.extraversion}`;
        const summaryB = `User ${userBId} - Openness: ${profileB.personality.openness}, Extraversion: ${profileB.personality.extraversion}`;

        // Create callbacks that emit to the socket room
        const callbacks: MatchCallbacks = {
          onStateChange: (state) => {
            namespace.to(sessionId).emit("state_change", { state });
          },
          onAgentMessage: (message) => {
            namespace.to(sessionId).emit("agent_message", {
              id: message.id,
              sender: message.sender,
              content: message.content,
              timestamp: message.timestamp,
            });
          },
          onCompatibilityUpdate: (score, breakdown) => {
            namespace.to(sessionId).emit("compatibility_update", {
              score,
              breakdown,
            });
          },
          onTimerTick: (elapsedSeconds) => {
            namespace.to(sessionId).emit("timer_tick", { elapsedSeconds });
          },
          onConversationEnd: (result) => {
            namespace.to(sessionId).emit("conversation_end", {
              compatibilityScore: result.compatibilityScore,
              breakdown: result.breakdown,
              recommendMatch: result.recommendMatch,
              trendOverTime: result.trendOverTime,
            });
          },
        };

        orchestrator = new MatchOrchestrator(
          sessionId,
          profileA,
          summaryA,
          profileB,
          summaryB,
          callbacks,
        );

        console.log(`[Conversation] Starting orchestrator for session ${sessionId}`);
        await orchestrator.start();
      } catch (error) {
        console.error("[Conversation] Start error:", error);
        socket.emit("error", { message: "Failed to start conversation" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Conversation] Client disconnected from session: ${sessionId}`);
      if (orchestrator) {
        orchestrator.stop();
        orchestrator = null;
      }
    });
  });
}
