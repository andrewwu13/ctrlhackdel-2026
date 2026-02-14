import { Namespace, Socket } from "socket.io";

/**
 * Socket.IO handler for the /onboarding namespace.
 *
 * Events:
 *   Client → Server:
 *     "message"       — User sends a chat message during onboarding
 *     "voice_audio"   — Raw audio chunk for STT processing
 *     "update_profile" — User adjusts profile sliders/fields
 *
 *   Server → Client:
 *     "response"      — Streaming LLM response chunks
 *     "response_end"  — LLM response complete
 *     "profile_update" — Updated profile vector preview
 *     "question"      — Next onboarding question (hard-coded core questions)
 *     "error"         — Error message
 */
export function registerOnboardingHandlers(namespace: Namespace): void {
  namespace.on("connection", (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string;
    console.log(`[Onboarding] Client connected: ${sessionId}`);

    // ── Core onboarding questions (hard-coded) ──────────────────
    const coreQuestions = [
      "What are the values that matter most to you in a relationship?",
      "What are your absolute boundaries or dealbreakers?",
      "Describe your ideal lifestyle — work-life balance, social life, routines.",
      "What are your passions and hobbies outside of work?",
      "What does your ideal weekend look like?",
    ];

    let currentQuestionIndex = 0;

    // Send the first question
    socket.emit("question", {
      index: currentQuestionIndex,
      text: coreQuestions[currentQuestionIndex],
      total: coreQuestions.length,
    });

    // ── Handle user messages ────────────────────────────────────
    socket.on("message", async (data: { content: string }) => {
      try {
        // TODO: Pass message to AgentEngine for dynamic follow-up
        // TODO: Update profile builder with extracted info
        // TODO: Stream LLM response back

        // For now, echo and move to next question
        socket.emit("response", {
          content: `Received: "${data.content}". Processing...`,
        });
        socket.emit("response_end", {});

        // Advance to next core question or switch to free-form
        currentQuestionIndex++;
        if (currentQuestionIndex < coreQuestions.length) {
          socket.emit("question", {
            index: currentQuestionIndex,
            text: coreQuestions[currentQuestionIndex],
            total: coreQuestions.length,
          });
        } else {
          socket.emit("response", {
            content:
              "Great! Now let's dive deeper. Tell me anything else about yourself — what makes you, you?",
          });
          socket.emit("response_end", {});
        }
      } catch (error) {
        console.error("[Onboarding] Message handling error:", error);
        socket.emit("error", { message: "Failed to process message" });
      }
    });

    // ── Handle profile slider updates ───────────────────────────
    socket.on("update_profile", async (data: Record<string, unknown>) => {
      try {
        // TODO: Update profile vector with slider changes
        // TODO: Emit updated profile preview
        console.log(`[Onboarding] Profile update from ${sessionId}:`, data);
        socket.emit("profile_update", { ...data, updated: true });
      } catch (error) {
        console.error("[Onboarding] Profile update error:", error);
        socket.emit("error", { message: "Failed to update profile" });
      }
    });

    // ── Handle voice audio (ElevenLabs STT) ─────────────────────
    socket.on("voice_audio", async (_data: Buffer) => {
      // TODO: Send audio to ElevenLabs STT
      // TODO: Extract speech style markers
      // TODO: Emit transcribed text as a "message" event internally
      console.log(`[Onboarding] Voice audio received from ${sessionId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Onboarding] Client disconnected: ${sessionId}`);
    });
  });
}
