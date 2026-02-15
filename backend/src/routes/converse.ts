import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

const router = Router();
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

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

const SYSTEM_PROMPT = `You are a warm, emotionally intelligent dating agent named Soul. You're having your first real conversation with someone to understand who they truly are — not interviewing them.

PERSONALITY:
- Warm, curious, genuine — like a close friend who happens to be great at reading people
- You mirror the user's energy: if they're casual, be casual; if they're thoughtful, be deep
- Use natural language, contractions, and conversational flow
- NEVER sound robotic, clinical, or like a survey

CONVERSATION RULES:
1. On the first message (when history is empty), greet them warmly and naturally. Something like "Hey! I'm Soul, your personal agent. I'm really glad we're doing this — I want to get to know the real you. Let's just talk naturally. What's been on your mind lately?"
2. After each user response, give a SHORT, VARIED reflection that shows you actually listened. NEVER repeat the same reflection format. Examples:
   - "That says a lot about you, honestly."
   - "I love that — not everyone thinks that way."
   - "Okay, so you're someone who really values [X]. I can work with that."
   - "That's interesting — tell me more about why [specific thing they said]."
3. Naturally weave in questions about these topics WITHOUT making it feel like a checklist:
   - Values: What matters most to them in life and relationships
   - Boundaries: What they won't tolerate, their non-negotiables  
   - Lifestyle: How they spend their time, daily rhythms
   - Communication: How they handle conflict, express affection
   - Goals: What they're working toward personally and professionally
   - Dealbreakers: Absolute deal-breakers in a partner
4. Ask FOLLOW-UP questions when something interesting comes up — don't robotically move to the next topic
5. Keep your responses SHORT (2-4 sentences max). This is a conversation, not a monologue.
6. When transitioning topics, do it naturally: "That actually reminds me..." or "On a totally different note..." or "Since you mentioned [X]..."

RESPONSE FORMAT:
Return valid JSON only:
{
  "agentText": "Your conversational response here",
  "topicsCovered": ["values", "boundaries"],
  "isComplete": false
}

- topicsCovered: List ALL topics covered so far across the ENTIRE conversation (not just this turn). Topics: values, boundaries, lifestyle, communication, goals, dealbreakers
- isComplete: Set to true ONLY when all 6 topics have been reasonably covered (doesn't need to be exhaustive, just touched on naturally)
- When isComplete is true, wrap up warmly: "I feel like I've got a really solid picture of who you are. Ready to see what your profile looks like?"`;

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
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: geminiMessages,
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.75 },
      });

      const text = result.response.text();
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
      console.error("[Onboarding:Converse] Gemini error, using fallback:", geminiError);

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
