import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ProfileBuilder } from "../services/profile-builder";
import { CompatibilityResultModel } from "../db/mongo";

const router = Router();

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
    const profileB = await ProfileBuilder.getProfileVector(userBId);

    if (!profileA) {
      res.status(404).json({ error: `ProfileVector not found for user ${userAId}` });
      return;
    }
    if (!profileB) {
      res.status(404).json({ error: `ProfileVector not found for user ${userBId}` });
      return;
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
