import { Namespace, Socket } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { ProfileBuilder } from "../services/profile-builder";
import type { UserProfile } from "../models/user";

/**
 * Socket.IO handler for the /onboarding namespace.
 *
 * Events:
 *   Client → Server:
 *     "message"       — User sends a chat message during onboarding
 *     "voice_audio"   — Raw audio chunk for STT processing
 *     "update_profile" — User adjusts profile sliders/fields
 *     "complete"      — User signals onboarding is done
 *
 *   Server → Client:
 *     "response"      — Streaming LLM response chunks
 *     "response_end"  — LLM response complete
 *     "profile_update" — Updated profile vector preview
 *     "question"      — Next onboarding question (hard-coded core questions)
 *     "onboarding_complete" — Profile built successfully
 *     "error"         — Error message
 */
export function registerOnboardingHandlers(namespace: Namespace): void {
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const profileBuilder = new ProfileBuilder();

  namespace.on("connection", (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string;
    const userId = (socket.handshake.query.userId as string) || sessionId;
    console.log(`[Onboarding] Client connected: ${sessionId}, user: ${userId}`);

    // ── Core onboarding questions (hard-coded) ──────────────────
    const coreQuestions = [
      "What are the values that matter most to you in a relationship?",
      "What are your absolute boundaries or dealbreakers?",
      "Describe your ideal lifestyle — work-life balance, social life, routines.",
      "What are your passions and hobbies outside of work?",
      "What does your ideal weekend look like?",
    ];

    let currentQuestionIndex = 0;
    const answers: string[] = [];
    const conversationHistory: Array<{ role: string; content: string }> = [];

    // Send the first question
    socket.emit("question", {
      index: currentQuestionIndex,
      text: coreQuestions[currentQuestionIndex],
      total: coreQuestions.length,
    });

    // ── Handle user messages ────────────────────────────────────
    socket.on("message", async (data: { content: string }) => {
      try {
        answers.push(data.content);
        conversationHistory.push({ role: "user", content: data.content });

        currentQuestionIndex++;

        if (currentQuestionIndex < coreQuestions.length) {
          // Still in core questions — acknowledge briefly and advance
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const ackResult = await model.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are an onboarding assistant for a dating app. You highly value user experience, and you are eager to learn more about the user's preferences. You are lighthearted and fun, but you also take your job seriously. The user just answered: "${data.content}". Give a warm, brief acknowledgment, then naturally transition to asking: "${coreQuestions[currentQuestionIndex]}"`,
                  },
                ],
              },
            ],
          });
          const ackText = ackResult.response.text();

          socket.emit("response", { content: ackText });
          socket.emit("response_end", {});
          conversationHistory.push({ role: "assistant", content: ackText });

          socket.emit("question", {
            index: currentQuestionIndex,
            text: coreQuestions[currentQuestionIndex],
            total: coreQuestions.length,
          });
        } else {
          // Core questions done — switch to free-form LLM conversation
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const historyText = conversationHistory
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

          const result = await model.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are an onboarding assistant for a dating app. You highly value user experience, and you are eager to learn more about the user's preferences. You are lighthearted and fun, but you also take your job seriously. Here's the conversation so far:\n${historyText}\n\nNow have a natural follow-up conversation to learn more about the user. Ask ONE specific follow-up question based on their previous answers. Be warm, curious, conversational, and most importantly, CREATIVE. Keep your response to 2-3 sentences max.`,
                  },
                ],
              },
            ],
          });

          const response = result.response.text();
          socket.emit("response", { content: response });
          socket.emit("response_end", {});
          conversationHistory.push({ role: "assistant", content: response });
        }
      } catch (error) {
        console.error("[Onboarding] Message handling error:", error);
        socket.emit("error", { message: "Failed to process message" });
      }
    });

    // ── Handle profile slider updates ───────────────────────────
    socket.on("update_profile", async (data: Record<string, unknown>) => {
      try {
        console.log(`[Onboarding] Profile update from ${sessionId}:`, data);
        socket.emit("profile_update", { ...data, updated: true });
      } catch (error) {
        console.error("[Onboarding] Profile update error:", error);
        socket.emit("error", { message: "Failed to update profile" });
      }
    });

    // ── Handle onboarding completion ────────────────────────────
    socket.on("complete", async () => {
      try {
        console.log(`[Onboarding] Building profile for user ${userId}`);

        // Build UserProfile from collected answers
        const profile: UserProfile = {
          userId,
          values: answers[0] ? answers[0].split(/[,;.]/).map((s) => s.trim()).filter(Boolean) : [],
          boundaries: answers[1] ? answers[1].split(/[,;.]/).map((s) => s.trim()).filter(Boolean) : [],
          lifestyle: answers[2] ? answers[2].split(/[,;.]/).map((s) => s.trim()).filter(Boolean) : [],
          interests: answers[3] ? answers[3].split(/[,;.]/).map((s) => s.trim()).filter(Boolean) : [],
          hobbies: answers[4] ? answers[4].split(/[,;.]/).map((s) => s.trim()).filter(Boolean) : [],
          freeformPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Store any extra free-form answers
        for (let i = 5; i < answers.length; i++) {
          profile.freeformPreferences[`followup_${i - 4}`] = answers[i];
        }

        // Build and persist profile vector
        const profileVector = await profileBuilder.buildProfileVector(profile);

        socket.emit("onboarding_complete", {
          userId,
          embeddingDimensions: profileVector.embedding.length,
          personality: profileVector.personality,
          message: "Profile built and saved successfully!",
        });

        console.log(`[Onboarding] Profile complete for user ${userId}, embedding dim: ${profileVector.embedding.length}`);
      } catch (error) {
        console.error("[Onboarding] Profile building error:", error);
        socket.emit("error", { message: "Failed to build profile" });
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

