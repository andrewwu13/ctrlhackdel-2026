import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { UserModel, UserProfileModel } from "../db/mongo";
import { config } from "../config";

const router = Router();
const oauthClient = new OAuth2Client();

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

const getProviderAfterPasswordSet = (
  existing?: string | null,
): "password" | "hybrid" => {
  if (existing === "google" || existing === "hybrid") return "hybrid";
  return "password";
};

const getProviderAfterGoogleSet = (
  existing?: string | null,
): "google" | "hybrid" => {
  if (existing === "password" || existing === "hybrid") return "hybrid";
  return "google";
};

const buildAuthResponse = async (user: {
  _id: { toString: () => string };
  email?: string | null;
  displayName?: string | null;
}) => {
  const userId = user._id.toString();
  const hasProfile = Boolean(await UserProfileModel.exists({ userId }));

  return {
    userId,
    email: user.email,
    displayName: user.displayName || "SoulBound User",
    hasProfile,
  };
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
    user.authProvider = getProviderAfterPasswordSet(user.authProvider);
    user.accountCreatedAt = new Date();

    await user.save();
    res.json(await buildAuthResponse(user));
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

    res.json(await buildAuthResponse(user));
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

/**
 * POST /api/auth/google
 * Verifies a Google ID token and links/logs in an account.
 */
router.post("/google", async (req: Request, res: Response) => {
  try {
    if (config.googleClientIds.length === 0) {
      res.status(503).json({ error: "Google OAuth is not configured on the backend" });
      return;
    }

    const { idToken, userId } = req.body as { idToken?: string; userId?: string };
    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: config.googleClientIds,
    });
    const payload = ticket.getPayload();

    const email = payload?.email?.trim().toLowerCase();
    const emailVerified = payload?.email_verified;
    const googleSub = payload?.sub;
    const displayName = payload?.name?.trim() || "SoulBound User";

    if (!email || !emailVerified || !googleSub) {
      res.status(401).json({ error: "Invalid Google token payload" });
      return;
    }

    // Existing Google-linked account
    let account = await UserModel.findOne({ googleSub });

    // Existing email account (password or previous OAuth)
    if (!account) {
      account = await UserModel.findOne({ email });
      if (account) {
        account.googleSub = googleSub;
        account.authProvider = getProviderAfterGoogleSet(account.authProvider);
        if (!account.displayName) account.displayName = displayName;
        if (!account.accountCreatedAt) account.accountCreatedAt = new Date();
        await account.save();
      }
    }

    // Link onboarding user if provided
    if (!account && userId) {
      const onboardingUser = await UserModel.findById(userId);
      if (!onboardingUser) {
        res.status(404).json({ error: "User not found for profile linkage" });
        return;
      }

      const profileExists = await UserProfileModel.exists({ userId });
      if (!profileExists) {
        res.status(400).json({ error: "Profile must be saved before creating an account" });
        return;
      }

      const emailOwner = await UserModel.findOne({ email });
      if (emailOwner && emailOwner._id.toString() !== userId) {
        res.status(409).json({ error: "Email is already in use" });
        return;
      }

      onboardingUser.email = email;
      onboardingUser.googleSub = googleSub;
      onboardingUser.displayName = onboardingUser.displayName || displayName;
      onboardingUser.authProvider = getProviderAfterGoogleSet(onboardingUser.authProvider);
      onboardingUser.accountCreatedAt = new Date();
      await onboardingUser.save();
      account = onboardingUser;
    }

    if (!account) {
      res
        .status(400)
        .json({ error: "No saved profile found for this Google account. Complete onboarding first." });
      return;
    }

    res.json(await buildAuthResponse(account));
  } catch (error) {
    console.error("[Auth] Google auth error:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

export default router;
