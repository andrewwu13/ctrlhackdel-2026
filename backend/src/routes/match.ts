import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ProfileBuilder } from "../services/profile-builder";
import { CompatibilityResultModel, ProfileVectorModel } from "../db/mongo";

const router = Router();

/**
 * GET /api/match/candidates?userId=xxx
 * Returns all other users ranked by pre-conversation compatibility score (descending).
 * Score = 0.6 * embedding_cosine_similarity + 0.4 * personality_cosine_similarity
 */
router.get("/candidates", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: "userId query param is required" });
      return;
    }

    const myProfile = await ProfileVectorModel.findOne({ userId }).lean();
    if (!myProfile) {
      res.status(404).json({ error: "Complete onboarding first" });
      return;
    }

    // Fetch all other profile vectors
    const others = await ProfileVectorModel.find({ userId: { $ne: userId } }).lean();

    const cosineSim = (a: number[], b: number[]): number => {
      if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      return denom === 0 ? 0 : dot / denom;
    };

    const myPersonality = Object.values(myProfile.personality || {}).filter((v): v is number => v != null);
    const myEmbedding = (myProfile.embedding || []) as number[];

    const candidates = others.map((other) => {
      const otherPersonality = Object.values(other.personality || {}).filter((v): v is number => v != null);
      const otherEmbedding = (other.embedding || []) as number[];

      const embeddingScore = cosineSim(myEmbedding, otherEmbedding);
      const personalityScore = cosineSim(myPersonality, otherPersonality);
      const preScore = Math.round((0.6 * embeddingScore + 0.4 * personalityScore) * 100);

      return {
        userId: other.userId,
        displayName: (other as Record<string, unknown>).displayName as string || "",
        preScore: Math.max(0, Math.min(100, preScore)),
        personality: other.personality,
      };
    });

    // Sort descending by preScore
    candidates.sort((a, b) => b.preScore - a.preScore);

    console.log(
      `[Match] Candidates for ${userId.slice(0, 8)}: ${candidates.length} users, top=${candidates[0]?.preScore ?? 0}%`
    );

    res.json({ candidates });
  } catch (error) {
    console.error("Candidates error:", error);
    res.status(500).json({ error: "Failed to compute candidates" });
  }
});

/**
 * POST /api/match/start
 * Initiates an agent-to-agent conversation session between two users.
 * Fetches both users' ProfileVectors from MongoDB.
 */
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { userAId, userBId } = req.body;

    if (!userAId || !userBId) {
      res.status(400).json({ error: "userAId and userBId are required" });
      return;
    }

    // Fetch both user profile vectors from MongoDB
    const profileA = await ProfileBuilder.getProfileVector(userAId);
    let profileB = await ProfileBuilder.getProfileVector(userBId);

    if (!profileA) {
      res.status(404).json({ error: `ProfileVector not found for user ${userAId}` });
      return;
    }

    // Auto-generate a demo agent if userBId has no profile
    if (!profileB) {
      console.log(`[Match] No ProfileVector for ${userBId}, generating demo agent`);
      const now = new Date();
      profileB = {
        userId: userBId,
        embedding: new Array(768).fill(0).map(() => Math.random() * 2 - 1),
        personality: {
          openness: 0.7,
          conscientiousness: 0.6,
          extraversion: 0.65,
          agreeableness: 0.75,
          neuroticism: 0.3,
        },
        hardFilters: {},
        softFilters: {},
        createdAt: now,
        updatedAt: now,
      };

      // Persist the demo agent to MongoDB so the socket handler can find it
      await ProfileVectorModel.findOneAndUpdate(
        { userId: userBId },
        {
          embedding: profileB.embedding,
          personality: profileB.personality,
          hardFilters: profileB.hardFilters,
          softFilters: profileB.softFilters,
        },
        { upsert: true, new: true }
      );
      console.log(`[Match] Persisted demo agent ${userBId} to MongoDB`);
    }

    const sessionId = uuidv4();

    console.log(`[Match] Starting session ${sessionId} between ${userAId} and ${userBId}`);

    // TODO: Initialize MatchOrchestrator session with profileA and profileB
    // This will be triggered when the client connects to the /conversation socket

    res.json({
      sessionId,
      userAId,
      userBId,
      socketNamespace: "/conversation",
      message: "Connect to Socket.IO namespace /conversation with this sessionId",
    });
  } catch (error) {
    console.error("Match start error:", error);
    res.status(500).json({ error: "Failed to start match session" });
  }
});

/**
 * GET /api/match/:sessionId
 * Returns the compatibility result for a completed session.
 */
router.get("/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Fetch CompatibilityResult from MongoDB
    const result = await CompatibilityResultModel.findOne({ sessionId }).lean();

    if (!result) {
      res.status(404).json({ error: "Session not found or not yet scored" });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error("Match fetch error:", error);
    res.status(500).json({ error: "Failed to fetch match result" });
  }
});

export default router;
