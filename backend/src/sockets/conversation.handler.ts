import { Namespace, Socket } from "socket.io";

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
    console.log(`[Conversation] Client connected for session: ${sessionId}`);

    // Join a room for this session so multiple observers can watch
    socket.join(sessionId);

    // ── Client signals ready ────────────────────────────────────
    socket.on("start", async () => {
      try {
        // TODO: Fetch MatchOrchestrator session
        // TODO: Start the INIT → LIVE state transition
        // TODO: Begin agent-to-agent conversation loop

        socket.emit("state_change", { state: "INIT" });

        // Placeholder: simulate state transition
        console.log(`[Conversation] Starting session ${sessionId}`);

        // TODO: The MatchOrchestrator will:
        // 1. Transition to LIVE state
        // 2. Alternate between Agent A and Agent B via AgentEngine
        // 3. For each message:
        //    a. Emit "agent_message" to the room
        //    b. Run ScoringEngine.updateScore()
        //    c. Emit "compatibility_update" with new score
        //    d. Emit "timer_tick" with elapsed seconds
        // 4. At 170s, transition to WRAP state
        // 5. At 180s, transition to SCORE state
        // 6. Emit "conversation_end" with final CompatibilityResult
      } catch (error) {
        console.error("[Conversation] Start error:", error);
        socket.emit("error", { message: "Failed to start conversation" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Conversation] Client disconnected from session: ${sessionId}`);
    });
  });
}
