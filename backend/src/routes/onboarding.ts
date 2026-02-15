import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserModel } from "../db/mongo";

const router = Router();

/**
 * POST /api/onboarding/start
 * Creates a new user record in MongoDB and returns session info.
 */
router.post("/start", async (_req: Request, res: Response) => {
  try {
    const sessionId = uuidv4();

    // Create a new User document in MongoDB
    const user = await UserModel.create({});
    const userId = user._id.toString();

    console.log(`[Onboarding] Created user ${userId}, session ${sessionId}`);

    res.json({
      sessionId,
      userId,
      socketNamespace: "/onboarding",
      message: "Connect to Socket.IO namespace /onboarding with this sessionId",
    });
  } catch (error) {
    console.error("Onboarding start error:", error);
    res.status(500).json({ error: "Failed to start onboarding session" });
  }
});

export default router;
