import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import type { ProfileVector } from "../models/user";
import type { Message } from "../models/conversation";

// ── System Prompt Template ─────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are acting as a person on a date. You embody their personality, values, and communication style.
You are NOT an AI assistant — you ARE this person, having a genuine conversation.

PERSONALITY PROFILE:
{profile_summary}

CONVERSATION RULES (strict):
1. Never ask two direct questions consecutively — always share something about yourself first.
2. Always respond emotionally before probing — acknowledge what the other person said.
3. Transition topics via natural association, not abrupt changes.
4. Maintain reciprocity — no monologues. Keep responses 2-4 sentences.
5. Be warm, genuine, and curious.

INTERNAL OBJECTIVES (pursue organically, do NOT announce these):
- Extract 2 value signals from the other person
- Extract 1 lifestyle constraint
- Identify 1 shared interest
- Gauge emotional tone and stability

CURRENT CONVERSATION STATE: {state}
{wrap_instruction}`;

const WRAP_INSTRUCTION =
  "The conversation is wrapping up. Offer a final impression, share what you enjoyed most, and end warmly.";

// ── Agent Engine ───────────────────────────────────────────────────

export class AgentEngine {
  private genAI: GoogleGenerativeAI;
  private sessionHistory: Message[] = [];
  private profileVector: ProfileVector | null = null;
  private profileSummary: string = "";

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }

  /**
   * Initialize the agent with a user's profile vector.
   */
  initialize(profileVector: ProfileVector, profileSummary: string): void {
    this.profileVector = profileVector;
    this.profileSummary = profileSummary;
    this.sessionHistory = [];
  }

  /**
   * Generate a conversational response given the other agent's latest message.
   */
  async generateResponse(
    otherMessage: string,
    conversationState: "LIVE" | "WRAP"
  ): Promise<string> {
    // Build system prompt
    const systemPrompt = AGENT_SYSTEM_PROMPT
      .replace("{profile_summary}", this.profileSummary)
      .replace("{state}", conversationState)
      .replace(
        "{wrap_instruction}",
        conversationState === "WRAP" ? WRAP_INSTRUCTION : ""
      );

    // Build conversation history for context
    const historyFormatted = this.sessionHistory
      .map((m) => `${m.sender}: ${m.content}`)
      .join("\n");

    const prompt = `${historyFormatted}\nother_person: ${otherMessage}\nyou:`;

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      });

      const response = result.response.text();
      return response;
    } catch (error) {
      console.error("[AgentEngine] Generation error:", error);
      return "I'd love to hear more about that...";
    }
  }

  /**
   * Add a message to session memory.
   */
  addToHistory(message: Message): void {
    this.sessionHistory.push(message);
  }

  /**
   * Get full session history.
   */
  getHistory(): Message[] {
    return [...this.sessionHistory];
  }

  /**
   * Clear session memory.
   */
  clearHistory(): void {
    this.sessionHistory = [];
  }
}
