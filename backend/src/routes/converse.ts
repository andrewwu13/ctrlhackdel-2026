import { Router, Request, Response } from "express";
import { generateWithRetry } from "../services/gemini-client";

const router = Router();

// ── Core topics the agent must cover naturally ─────────────────────
const CORE_TOPICS = [
  "values",
  "boundaries",
  "lifestyle",
  "communication",
  "goals",
  "dealbreakers",
] as const;

type CoreTopic = (typeof CORE_TOPICS)[number];

type ConversationMessage = {
  role: "user" | "agent";
  content: string;
};

// ── System prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Soul, a warm dating agent having a natural first conversation. Be genuine and brief.

RULES:
- Keep responses to 1-2 SHORT sentences max. Be concise.
- Sound like a real person texting, not a therapist or interviewer.
- Mirror the user's energy and vibe.
- After each response, naturally lead into one of these uncovered topics: values, boundaries, lifestyle, communication, goals, dealbreakers.
- When greeting (empty history), say something brief like: "Hey! I'm Soul. Let's chat — what's been on your mind lately?"
- When all 6 topics are covered, set isComplete to true and wrap up warmly in one sentence.

You MUST respond with this exact JSON schema:
{"agentText": "string", "topicsCovered": ["string"], "isComplete": boolean}

- agentText: Your short, conversational response
- topicsCovered: ALL topics covered so far across the entire conversation (cumulative)
- isComplete: true only when all 6 topics have been touched on`;

/**
 * POST /api/onboarding/converse
 *
 * Body: { transcript: string, history: ConversationMessage[] }
 * Returns: { agentText: string, topicsCovered: string[], isComplete: boolean }
 */
router.post("/converse", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { transcript, history } = req.body as {
      transcript: string;
      history: ConversationMessage[];
    };

    if (!transcript || typeof transcript !== "string") {
      res.status(400).json({ error: "transcript string is required" });
      return;
    }

    const safeHistory: ConversationMessage[] = Array.isArray(history)
      ? history
      : [];

    // ── Log incoming transcript ────────────────────────────────
    console.log(
      `[Onboarding:Converse] Turn ${safeHistory.length + 1} | User said: "${transcript.slice(0, 200)}${transcript.length > 200 ? "..." : ""}"`,
    );

    // ── Build messages for Gemini ──────────────────────────────
    const geminiMessages = safeHistory.map((msg) => ({
      role: msg.role === "agent" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

    // Add the new user message
    geminiMessages.push({
      role: "user" as const,
      parts: [{ text: transcript }],
    });

    try {
      const text = await generateWithRetry(
        {
          contents: geminiMessages,
          systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] } as never,
        },
        { caller: "Onboarding:Converse", temperature: 0.75, jsonMode: true },
      );

      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("Gemini response was not valid JSON");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        agentText?: string;
        topicsCovered?: string[];
        isComplete?: boolean;
      };

      const agentText =
        parsed.agentText?.trim() || "That's really interesting. Tell me more.";
      const topicsCovered = (parsed.topicsCovered || []).filter(
        (t): t is CoreTopic =>
          CORE_TOPICS.includes(t as CoreTopic),
      );
      const isComplete = Boolean(parsed.isComplete);

      const elapsed = Date.now() - startTime;
      console.log(
        `[Onboarding:Converse] Agent response (${elapsed}ms) | Topics: [${topicsCovered.join(", ")}] | Complete: ${isComplete} | "${agentText.slice(0, 120)}..."`,
      );

      res.json({ agentText, topicsCovered, isComplete });
    } catch (geminiError) {
      console.error("[Onboarding:Converse] Gemini failed after retries, using fallback:", geminiError instanceof Error ? geminiError.message : geminiError);

      // ── Fallback: cycle through natural prompts ──────────────
      const fallbackResponses = [
        "That's really thoughtful. So what would you say matters most to you in a relationship?",
        "I appreciate you sharing that. What does your ideal day-to-day look like?",
        "That's interesting — when things get tough, how do you usually handle conflict?",
        "I'm getting a good sense of who you are. What are you working toward right now?",
        "Almost there — what's something that's a total dealbreaker for you in a partner?",
        "I feel like I've got a really great picture of who you are. Ready to see your profile?",
      ];

      const turnIndex = Math.min(
        safeHistory.filter((m) => m.role === "user").length,
        fallbackResponses.length - 1,
      );

      const isLastFallback = turnIndex >= fallbackResponses.length - 1;
      const coveredTopics = CORE_TOPICS.slice(0, turnIndex + 1) as unknown as string[];

      res.json({
        agentText: fallbackResponses[turnIndex],
        topicsCovered: coveredTopics,
        isComplete: isLastFallback,
      });
    }
  } catch (error) {
    console.error("[Onboarding:Converse] Error:", error);
    res.status(500).json({ error: "Conversation turn failed" });
  }
});

export default router;
