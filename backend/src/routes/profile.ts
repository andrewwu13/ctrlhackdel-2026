import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { ProfileBuilder } from "../services/profile-builder";
import { UserModel } from "../db/mongo";
import type { UserProfile } from "../models/user";

const router = Router();
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const profileBuilder = new ProfileBuilder();

/**
 * POST /api/profile/generate
 * Accepts interview answers, generates a profile via Gemini, and persists to MongoDB.
 * Returns the generated profile + userId.
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { answers } = req.body as { answers: string[] };

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: "answers array is required" });
      return;
    }

    // ── Generate profile JSON via Gemini ─────────────────────────
    const prompt = `You are generating a user profile for an autonomous personal agent.
Return valid JSON only with this exact schema:
{
  "name": "string",
  "headline": "string",
  "bio": "string",
  "coreValues": ["string"],
  "communicationStyle": "string",
  "goals": ["string"],
  "dealbreakers": ["string"]
}
Use the interview answers below and infer reasonable defaults when details are missing.
Interview answers:\n${answers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;

    let generatedProfile;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("Unable to parse Gemini JSON response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      generatedProfile = {
        name: parsed.name?.trim() || "User",
        headline: parsed.headline?.trim() || "Intentional and values-driven",
        bio: parsed.bio?.trim() || answers.join(" ").slice(0, 350),
        coreValues: (parsed.coreValues || []).filter(Boolean),
        communicationStyle: parsed.communicationStyle?.trim() || "Clear and collaborative",
        goals: (parsed.goals || []).filter(Boolean),
        dealbreakers: (parsed.dealbreakers || []).filter(Boolean),
      };
    } catch (geminiError) {
      console.error("[Profile] Gemini generation failed, using fallback:", geminiError);
      const combined = answers.join(" ").trim();
      generatedProfile = {
        name: "User",
        headline: "Mission-driven collaborator",
        bio: combined.slice(0, 350) || "Profile created from interview answers.",
        coreValues: ["Empathy", "Growth", "Integrity"],
        communicationStyle: "Clear, respectful, and direct",
        goals: ["Build meaningful relationships", "Stay aligned with long-term priorities"],
        dealbreakers: ["Dishonesty", "Disrespect", "Value misalignment"],
      };
    }

    // ── Create User + Profile in MongoDB ─────────────────────────
    const user = await UserModel.create({});
    const userId = user._id.toString();

    const userProfile: UserProfile = {
      userId,
      values: generatedProfile.coreValues,
      boundaries: generatedProfile.dealbreakers,
      lifestyle: [],
      interests: generatedProfile.goals,
      hobbies: [],
      freeformPreferences: {
        bio: generatedProfile.bio,
        headline: generatedProfile.headline,
        communicationStyle: generatedProfile.communicationStyle,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileVector = await profileBuilder.buildProfileVector(userProfile);

    console.log(`[Profile] Generated profile for user ${userId}, embedding dim: ${profileVector.embedding.length}`);

    res.json({
      userId,
      profile: generatedProfile,
      embeddingDimensions: profileVector.embedding.length,
      personality: profileVector.personality,
    });
  } catch (error) {
    console.error("[Profile] Generation error:", error);
    res.status(500).json({ error: "Failed to generate profile" });
  }
});

export default router;
