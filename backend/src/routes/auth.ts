import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import { UserModel, UserProfileModel } from "../db/mongo";

const router = Router();

const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};

/**
 * POST /api/auth/register
 * Creates account credentials for an existing user profile.
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { userId, email, password, displayName } = req.body as {
      userId?: string;
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await UserModel.findById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const profileExists = await UserProfileModel.exists({ userId });
    if (!profileExists) {
      res.status(400).json({ error: "Profile must be saved before creating an account" });
      return;
    }

    const emailOwner = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (emailOwner && emailOwner._id.toString() !== userId) {
      res.status(409).json({ error: "Email is already in use" });
      return;
    }

    user.email = normalizedEmail;
    user.passwordHash = hashPassword(password);
    user.displayName = displayName?.trim() || user.displayName || "SoulBound User";
    user.accountCreatedAt = new Date();

    await user.save();

    res.json({
      userId,
      email: user.email,
      displayName: user.displayName,
      hasProfile: true,
    });
  } catch (error) {
    console.error("[Auth] Register error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /api/auth/login
 * Authenticates an account and returns user profile linkage.
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const userId = user._id.toString();
    const hasProfile = Boolean(await UserProfileModel.exists({ userId }));

    res.json({
      userId,
      email: user.email,
      displayName: user.displayName || "SoulBound User",
      hasProfile,
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

export default router;
