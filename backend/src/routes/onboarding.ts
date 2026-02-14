import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * POST /api/onboarding/start
 * Creates a new onboarding session for a user.
 * Returns a session ID that the client uses to connect via Socket.IO.
 */
router.post("/start", async (_req: Request, res: Response) => {
  try {
    const sessionId = uuidv4();

    // TODO: Create user record in MongoDB
    // TODO: Initialize onboarding session state

    res.json({
      sessionId,
      socketNamespace: "/onboarding",
      message: "Connect to Socket.IO namespace /onboarding with this sessionId",
    });
  } catch (error) {
    console.error("Onboarding start error:", error);
    res.status(500).json({ error: "Failed to start onboarding session" });
  }
});

export default router;
