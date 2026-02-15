import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import type { Message } from "../models/conversation";

// ── Message Enrichment Service ─────────────────────────────────────
// Computes sentiment and topic embeddings for each agent message
// using Gemini models.

export class MessageEnrichmentService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }

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
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent({
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
      });

      const response = result.response.text().trim();
      const score = parseFloat(response);

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
    } catch (error: any) {
      if (error.message?.includes("429") || error.status === 429) {
        console.warn(
          "[MessageEnrichment] Sentiment quota exceeded (429). Skipping sentiment analysis."
        );
        return 0;
      }
      console.error("[MessageEnrichment] Sentiment error:", error);
      return 0;
    }
  }

  /**
   * Compute a topic embedding vector using Gemini text-embedding-004.
   */
  private async computeTopicEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "text-embedding-004",
      });

      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error: any) {
      if (error.message?.includes("429") || error.status === 429) {
        console.warn(
          "[MessageEnrichment] Embedding quota exceeded (429). Skipping topic embedding."
        );
        return [];
      }
      console.error("[MessageEnrichment] Embedding error:", error);
      return [];
    }
  }
}
