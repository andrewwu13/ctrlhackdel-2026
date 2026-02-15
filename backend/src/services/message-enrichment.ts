import { generateWithRetry, embedWithRetry } from "./gemini-client";
import type { Message } from "../models/conversation";

// ── Message Enrichment Service ─────────────────────────────────────
// Computes sentiment and topic embeddings for each agent message
// using the shared Gemini client with retry logic.

export class MessageEnrichmentService {
  /**
   * Enrich a message with sentiment and topic embedding.
   * Mutates the message object in place and returns it.
   */
  async enrich(message: Message): Promise<Message> {
    const [sentiment, topicEmbedding] = await Promise.all([
      this.computeSentiment(message.content),
      this.computeTopicEmbedding(message.content),
    ]);

    message.sentiment = sentiment;
    message.topicEmbedding = topicEmbedding;
    message.tokenCount = Math.ceil(message.content.length / 4);

    console.log(
      `[MessageEnrichment] ${message.sender}: sentiment=${sentiment.toFixed(2)}, embedding_dim=${topicEmbedding.length}`
    );

    return message;
  }

  /**
   * Compute sentiment score (-1 to 1) using Gemini.
   */
  private async computeSentiment(text: string): Promise<number> {
    try {
      const response = await generateWithRetry(
        {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Analyze the sentiment of this message from a dating conversation. Return ONLY a single number between -1.0 (very negative) and 1.0 (very positive). No explanation.\n\nMessage: "${text}"`,
                },
              ],
            },
          ],
        },
        { caller: "MessageEnrichment:Sentiment" },
      );

      const score = parseFloat(response.trim());

      if (!isNaN(score) && score >= -1 && score <= 1) {
        return score;
      }

      // Try to extract a number from the response
      const numberMatch = response.match(/-?\d+\.?\d*/);
      if (numberMatch) {
        const extracted = parseFloat(numberMatch[0]);
        return Math.max(-1, Math.min(1, extracted));
      }

      return 0;
    } catch (error) {
      console.error("[MessageEnrichment] Sentiment analysis failed after retries:", error instanceof Error ? error.message : error);
      return 0;
    }
  }

  /**
   * Compute a topic embedding vector using Gemini text-embedding-004.
   */
  private async computeTopicEmbedding(text: string): Promise<number[]> {
    try {
      return await embedWithRetry(text, { caller: "MessageEnrichment:Embedding" });
    } catch (error) {
      console.error("[MessageEnrichment] Topic embedding failed after retries:", error instanceof Error ? error.message : error);
      return [];
    }
  }
}
