import { generateWithRetry, embedWithRetry } from "./gemini-client";
import type { UserProfile, ProfileVector, PersonalityVector } from "../models/user";
import { UserProfileModel, ProfileVectorModel } from "../db/mongo";

// ── Profile Builder ────────────────────────────────────────────────

export class ProfileBuilder {
  /**
   * Build a complete ProfileVector from onboarding data and persist to MongoDB.
   */
  async buildProfileVector(profile: UserProfile): Promise<ProfileVector> {
    const embedding = await this.generateEmbedding(profile);
    const personality = await this.extractPersonalityTraits(profile);
    const { hardFilters, softFilters } = this.extractFilters(profile);

    const profileVector: ProfileVector = {
      userId: profile.userId,
      embedding,
      personality,
      hardFilters,
      softFilters,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Persist UserProfile to MongoDB (upsert by userId)
    const displayName = profile.freeformPreferences?.name || "";
    const bio = profile.freeformPreferences?.bio || "";
    const headline = profile.freeformPreferences?.headline || "";

    await UserProfileModel.findOneAndUpdate(
      { userId: profile.userId },
      {
        displayName,
        headline,
        bio,
        values: profile.values,
        boundaries: profile.boundaries,
        lifestyle: profile.lifestyle,
        interests: profile.interests,
        hobbies: profile.hobbies,
        freeformPreferences: profile.freeformPreferences,
        speechStyleMarkers: profile.speechStyleMarkers || [],
      },
      { upsert: true, new: true }
    );
    console.log(`[ProfileBuilder] Saved UserProfile for ${profile.userId}`);

    // Persist ProfileVector to MongoDB (upsert by userId)
    await ProfileVectorModel.findOneAndUpdate(
      { userId: profile.userId },
      {
        displayName,
        bio,
        embedding: profileVector.embedding,
        personality: profileVector.personality,
        hardFilters: profileVector.hardFilters,
        softFilters: profileVector.softFilters,
      },
      { upsert: true, new: true }
    );
    console.log(`[ProfileBuilder] Saved ProfileVector for ${profile.userId}`);

    return profileVector;
  }

  /**
   * Fetch a stored ProfileVector from MongoDB.
   */
  static async getProfileVector(userId: string): Promise<ProfileVector | null> {
    const doc = await ProfileVectorModel.findOne({ userId }).lean();
    if (!doc) return null;

    return {
      userId: doc.userId,
      embedding: doc.embedding as number[],
      personality: doc.personality as PersonalityVector,
      hardFilters: doc.hardFilters instanceof Map
        ? Object.fromEntries(doc.hardFilters)
        : (doc.hardFilters as unknown as Record<string, string | boolean>) ?? {},
      softFilters: doc.softFilters instanceof Map
        ? Object.fromEntries(doc.softFilters)
        : (doc.softFilters as unknown as Record<string, number>) ?? {},
      createdAt: doc.createdAt!,
      updatedAt: doc.updatedAt!,
    };
  }

  /**
   * Generate a dense embedding vector from profile text using Gemini.
   */
  private async generateEmbedding(profile: UserProfile): Promise<number[]> {
    try {
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

      return await embedWithRetry(profileText, { caller: "ProfileBuilder:Embedding" });
    } catch (error) {
      console.error("[ProfileBuilder] Embedding generation error after retries:", error instanceof Error ? error.message : error);
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
      const prompt = `Based on the following user profile, estimate their Big-5 personality traits as scores from 0.0 to 1.0.
Respond ONLY with a JSON object: {"openness": X, "conscientiousness": X, "extraversion": X, "agreeableness": X, "neuroticism": X}

Profile:
Values: ${profile.values.join(", ")}
Lifestyle: ${profile.lifestyle.join(", ")}
Interests: ${profile.interests.join(", ")}
Hobbies: ${profile.hobbies.join(", ")}`;

      const text = await generateWithRetry(
        { contents: [{ role: "user", parts: [{ text: prompt }] }] },
        { caller: "ProfileBuilder:Personality", jsonMode: true },
      );

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as PersonalityVector;
      }
    } catch (error) {
      console.error("[ProfileBuilder] Personality extraction error after retries:", error instanceof Error ? error.message : error);
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
