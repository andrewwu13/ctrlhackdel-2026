import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import type { UserProfile, ProfileVector, PersonalityVector } from "../models/user";

// ── Profile Builder ────────────────────────────────────────────────

export class ProfileBuilder {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }

  /**
   * Build a complete ProfileVector from onboarding data.
   */
  async buildProfileVector(profile: UserProfile): Promise<ProfileVector> {
    const embedding = await this.generateEmbedding(profile);
    const personality = await this.extractPersonalityTraits(profile);
    const { hardFilters, softFilters } = this.extractFilters(profile);

    return {
      userId: profile.userId,
      embedding,
      personality,
      hardFilters,
      softFilters,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate a dense embedding vector from profile text using Gemini.
   */
  private async generateEmbedding(profile: UserProfile): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "text-embedding-004",
      });

      const profileText = [
        `Values: ${profile.values.join(", ")}`,
        `Boundaries: ${profile.boundaries.join(", ")}`,
        `Lifestyle: ${profile.lifestyle.join(", ")}`,
        `Interests: ${profile.interests.join(", ")}`,
        `Hobbies: ${profile.hobbies.join(", ")}`,
        ...Object.entries(profile.freeformPreferences).map(
          ([k, v]) => `${k}: ${v}`
        ),
      ].join(". ");

      const result = await model.embedContent(profileText);
      return result.embedding.values;
    } catch (error) {
      console.error("[ProfileBuilder] Embedding generation error:", error);
      // Return a zero vector as fallback
      return new Array(768).fill(0);
    }
  }

  /**
   * Extract Big-5 personality traits from profile answers using Gemini.
   */
  private async extractPersonalityTraits(
    profile: UserProfile
  ): Promise<PersonalityVector> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Based on the following user profile, estimate their Big-5 personality traits as scores from 0.0 to 1.0.
Respond ONLY with a JSON object: {"openness": X, "conscientiousness": X, "extraversion": X, "agreeableness": X, "neuroticism": X}

Profile:
Values: ${profile.values.join(", ")}
Lifestyle: ${profile.lifestyle.join(", ")}
Interests: ${profile.interests.join(", ")}
Hobbies: ${profile.hobbies.join(", ")}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as PersonalityVector;
      }
    } catch (error) {
      console.error("[ProfileBuilder] Personality extraction error:", error);
    }

    // Fallback: neutral personality
    return {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
    };
  }

  /**
   * Extract hard and soft filters from profile data.
   */
  private extractFilters(profile: UserProfile): {
    hardFilters: Record<string, string | boolean>;
    softFilters: Record<string, number>;
  } {
    const hardFilters: Record<string, string | boolean> = {};
    const softFilters: Record<string, number> = {};

    // Convert boundaries to hard filters
    for (const boundary of profile.boundaries) {
      hardFilters[boundary.toLowerCase().replace(/\s+/g, "_")] = true;
    }

    // Convert interests to soft filters (weighted by position)
    profile.interests.forEach((interest, index) => {
      softFilters[interest.toLowerCase().replace(/\s+/g, "_")] =
        1.0 - index * 0.1;
    });

    return { hardFilters, softFilters };
  }
}
