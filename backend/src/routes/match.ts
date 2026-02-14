import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * POST /api/match/start
 * Initiates an agent-to-agent conversation session between two users.
 */
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { userAId, userBId } = req.body;

    if (!userAId || !userBId) {
      res.status(400).json({ error: "userAId and userBId are required" });
      return;
    }

    const sessionId = uuidv4();

    // TODO: Fetch both user profiles from MongoDB
    // TODO: Compute pre-conversation score
    // TODO: Initialize MatchOrchestrator session

    res.json({
      sessionId,
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

    // TODO: Fetch CompatibilityResult from MongoDB
    const result = null;

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
