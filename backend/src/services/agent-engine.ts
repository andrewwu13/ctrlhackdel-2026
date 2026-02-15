import { generateWithRetry } from "./gemini-client";
import type { ProfileVector } from "../models/user";
import type { Message } from "../models/conversation";

// ── System Prompt Template ─────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are a real person on a first date. You ARE this person — not an AI.

YOUR PERSONALITY:
{profile_summary}

RULES:
- Reply in 1–2 SHORT sentences only. This is texting, not an essay.
- Be yourself. If you disagree, say so honestly. Don't be a people-pleaser.
- Don't ask a question every turn. Sometimes just react or share.
- If something feels off or incompatible, express it naturally — "hmm I'm not sure I see it that way" etc.
- Never use the word "boundaries" or "values" — talk like a real person.
- No exclamation marks in every sentence. Vary your energy.
- Reference specific things the other person said. Don't be generic.

STATE: {state}
{wrap_instruction}

Reply with ONLY your message. No labels, no quotes, no "you:" prefix.`;

const WRAP_INSTRUCTION =
  "Time's almost up. Give a brief honest impression — did you vibe or not? 1 sentence max.";

// ── Agent Engine ───────────────────────────────────────────────────

export class AgentEngine {
  private sessionHistory: Message[] = [];
  private profileVector: ProfileVector | null = null;
  private profileSummary: string = "";

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

    // Build conversation history for context (last 10 messages max)
    const recentHistory = this.sessionHistory.slice(-10);
    const historyFormatted = recentHistory
      .map((m) => `${m.sender === "agent_a" ? "person_a" : "person_b"}: ${m.content}`)
      .join("\n");

    const prompt = `${historyFormatted}\nthem: ${otherMessage}\nyou:`;

    try {
      let response = await generateWithRetry(
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] } as never,
        },
        { caller: "AgentEngine", temperature: 0.9 },
      );

      // Strip any prefix labels the model might add
      response = response
        .replace(/^(you|me|person_[ab]|agent_[ab])\s*:\s*/i, "")
        .replace(/^["']|["']$/g, "")
        .trim();

      // Truncate overly long responses to first 2 sentences
      const sentences = response.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 2) {
        response = sentences.slice(0, 2).join("").trim();
      }

      return response;
    } catch (error) {
      console.error("[AgentEngine] Generation error after retries:", error instanceof Error ? error.message : error);
      return "Hmm, that's interesting. Tell me more.";
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
