import { randomUUID } from "node:crypto";
import { Router, Request, Response } from "express";
import { generateWithRetry } from "../services/gemini-client";
import { ProfileBuilder } from "../services/profile-builder";
import { UserModel, UserProfileModel, ProfileVectorModel } from "../db/mongo";
import type { UserProfile, UpcomingDate } from "../models/user";

const router = Router();
const profileBuilder = new ProfileBuilder();

type EditableProfilePayload = {
  name: string;
  headline: string;
  bio: string;
  coreValues: string[];
  communicationStyle: string;
  goals: string[];
  dealbreakers: string[];
  interests: string[];
  hobbies: string[];
  lifestyle: string[];
};

type PersonalityPayload = {
  openness: number;
  extraversion: number;
  agreeableness: number;
  emotionalStability: number;
};

type EditableProfileDetails = {
  name?: string;
  headline?: string;
  bio?: string;
  communicationStyle?: string;
  avatarUrl?: string;
  values?: string[];
  boundaries?: string[];
  lifestyle?: string[];
  interests?: string[];
  hobbies?: string[];
};

type EditableAccountDetails = {
  displayName?: string;
};

type MatchGender = "female" | "male" | "any";

const FEMALE_AGENT_NAMES = ["Ava", "Mia", "Sofia", "Luna", "Nora", "Zara"];
const MALE_AGENT_NAMES = ["Ethan", "Noah", "Liam", "Milo", "Arjun", "Kai"];

const mapFromFreeform = (value: unknown): Record<string, string> => {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries()) as Record<string, string>;
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, entry]) => {
        if (typeof entry === "string") acc[key] = entry;
        return acc;
      },
      {},
    );
  }
  return {};
};

const normalizeUpcomingDates = (value: unknown): UpcomingDate[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const dateEntry = entry as Partial<UpcomingDate>;
      const scheduledAt = new Date(String(dateEntry.scheduledAt ?? ""));
      const createdAt = new Date(String(dateEntry.createdAt ?? ""));

      if (!dateEntry.id || !dateEntry.withName || !dateEntry.place || Number.isNaN(scheduledAt.getTime())) {
        return null;
      }

      return {
        id: dateEntry.id,
        sessionId: dateEntry.sessionId,
        withName: dateEntry.withName,
        place: dateEntry.place,
        scheduledAt,
        status: dateEntry.status === "declined" ? "declined" : "scheduled",
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      } as UpcomingDate;
    })
    .filter((entry): entry is UpcomingDate => entry !== null)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
};

const inferPreferredMatchGender = (profile: {
  values?: string[];
  boundaries?: string[];
  lifestyle?: string[];
  interests?: string[];
  hobbies?: string[];
  freeformPreferences?: Record<string, string>;
}): MatchGender => {
  const combinedText = [
    ...(profile.values || []),
    ...(profile.boundaries || []),
    ...(profile.lifestyle || []),
    ...(profile.interests || []),
    ...(profile.hobbies || []),
    ...Object.values(profile.freeformPreferences || {}),
  ]
    .join(" ")
    .toLowerCase();

  const includes = (terms: string[]) => terms.some((term) => combinedText.includes(term));

  if (includes(["looking for men", "looking for a man", "boyfriend", "husband", "he/him", "male partner"])) {
    return "male";
  }

  if (includes(["looking for women", "looking for a woman", "girlfriend", "wife", "she/her", "female partner"])) {
    return "female";
  }

  if (includes(["he/him"])) return "female";
  if (includes(["she/her"])) return "male";

  return "any";
};

const getDeterministicPersona = (userId: string, preferredMatchGender: MatchGender) => {
  const combinedList = [...FEMALE_AGENT_NAMES, ...MALE_AGENT_NAMES];
  const sourceList =
    preferredMatchGender === "female"
      ? FEMALE_AGENT_NAMES
      : preferredMatchGender === "male"
        ? MALE_AGENT_NAMES
        : combinedList;

  const seed = [...userId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const name = sourceList[seed % sourceList.length];
  const gender = FEMALE_AGENT_NAMES.includes(name) ? "female" : "male";

  return {
    id: "demo-agent",
    name,
    gender,
    avatarSeed: (seed * 13) % 97,
  };
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const buildProfileSnapshot = async (userId: string) => {
  const [user, userProfileDoc] = await Promise.all([
    UserModel.findById(userId).lean(),
    UserProfileModel.findOne({ userId }).lean(),
  ]);

  if (!user || !userProfileDoc) return null;

  const freeformPreferences = mapFromFreeform(userProfileDoc.freeformPreferences);
  const upcomingDates = normalizeUpcomingDates(
    (userProfileDoc as { upcomingDates?: unknown }).upcomingDates,
  );
  const preferredGender = inferPreferredMatchGender({
    values: userProfileDoc.values as string[] | undefined,
    boundaries: userProfileDoc.boundaries as string[] | undefined,
    lifestyle: userProfileDoc.lifestyle as string[] | undefined,
    interests: userProfileDoc.interests as string[] | undefined,
    hobbies: userProfileDoc.hobbies as string[] | undefined,
    freeformPreferences,
  });
  const suggestedMatchPersona = getDeterministicPersona(userId, preferredGender);

  const displayName =
    (typeof user.displayName === "string" && user.displayName.trim()) ||
    freeformPreferences.name ||
    "SoulBound User";

  return {
    userId,
    account: {
      displayName,
      email: user.email || null,
      authProvider: user.authProvider || null,
      avatarUrl: freeformPreferences.avatarUrl || null,
    },
    profile: {
      name: freeformPreferences.name || displayName,
      headline: freeformPreferences.headline || "",
      bio: freeformPreferences.bio || "",
      communicationStyle: freeformPreferences.communicationStyle || "",
      avatarUrl: freeformPreferences.avatarUrl || "",
      values: (userProfileDoc.values as string[] | undefined) || [],
      boundaries: (userProfileDoc.boundaries as string[] | undefined) || [],
      lifestyle: (userProfileDoc.lifestyle as string[] | undefined) || [],
      interests: (userProfileDoc.interests as string[] | undefined) || [],
      hobbies: (userProfileDoc.hobbies as string[] | undefined) || [],
      upcomingDates,
    },
    suggestedMatchPersona,
  };
};

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
      const text = await generateWithRetry(
        { contents: [{ role: "user", parts: [{ text: prompt }] }] },
        { caller: "Profile:Generate", temperature: 0.4, jsonMode: true },
      );

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
      console.error(
        "[Profile] Gemini generation failed after retries, using fallback:",
        geminiError instanceof Error ? geminiError.message : geminiError,
      );
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
        name: generatedProfile.name,
        bio: generatedProfile.bio,
        headline: generatedProfile.headline,
        communicationStyle: generatedProfile.communicationStyle,
      },
      upcomingDates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileVector = await profileBuilder.buildProfileVector(userProfile);

    console.log(
      `[Profile] Generated profile for user ${userId}, embedding dim: ${profileVector.embedding.length}`,
    );

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

/**
 * POST /api/profile/save
 * Persists edited profile values before account creation.
 */
router.post("/save", async (req: Request, res: Response) => {
  try {
    const { userId, profile, personality } = req.body as {
      userId?: string;
      profile?: EditableProfilePayload;
      personality?: PersonalityPayload;
    };

    if (!userId || !profile) {
      res.status(400).json({ error: "userId and profile are required" });
      return;
    }

    const userExists = await UserModel.exists({ _id: userId });
    if (!userExists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userProfile: UserProfile = {
      userId,
      values: Array.isArray(profile.coreValues) ? profile.coreValues : [],
      boundaries: Array.isArray(profile.dealbreakers) ? profile.dealbreakers : [],
      lifestyle: Array.isArray(profile.lifestyle) ? profile.lifestyle : [],
      interests:
        Array.isArray(profile.interests) && profile.interests.length > 0
          ? profile.interests
          : Array.isArray(profile.goals)
            ? profile.goals
            : [],
      hobbies: Array.isArray(profile.hobbies) ? profile.hobbies : [],
      freeformPreferences: {
        name: profile.name || "User",
        headline: profile.headline || "",
        bio: profile.bio || "",
        communicationStyle: profile.communicationStyle || "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileVector = await profileBuilder.buildProfileVector(userProfile);

    if (personality) {
      await ProfileVectorModel.findOneAndUpdate(
        { userId },
        {
          personality: {
            openness: personality.openness,
            conscientiousness: 0.5,
            extraversion: personality.extraversion,
            agreeableness: personality.agreeableness,
            neuroticism: 1 - personality.emotionalStability,
          },
        },
        { new: true },
      );
    }

    res.json({
      userId,
      saved: true,
      embeddingDimensions: profileVector.embedding.length,
    });
  } catch (error) {
    console.error("[Profile] Save error:", error);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

/**
 * GET /api/profile/me?userId=<id>
 * Returns account + profile details for rendering the profile and lounge headers.
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || "").trim();

    if (!userId) {
      res.status(400).json({ error: "userId query param is required" });
      return;
    }

    const snapshot = await buildProfileSnapshot(userId);
    if (!snapshot) {
      res.status(404).json({ error: "User or profile not found" });
      return;
    }

    res.json(snapshot);
  } catch (error) {
    console.error("[Profile] Fetch error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * PATCH /api/profile/me
 * Updates account/profile fields including avatar URL and list preferences.
 */
router.patch("/me", async (req: Request, res: Response) => {
  try {
    const { userId, account, profile } = req.body as {
      userId?: string;
      account?: EditableAccountDetails;
      profile?: EditableProfileDetails;
    };

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const existingProfileDoc = await UserProfileModel.findOne({ userId }).lean();
    const existingFreeform = mapFromFreeform(existingProfileDoc?.freeformPreferences);

    const mergedFreeform: Record<string, string> = {
      ...existingFreeform,
    };

    if (profile?.name !== undefined) mergedFreeform.name = profile.name.trim();
    if (profile?.headline !== undefined) mergedFreeform.headline = profile.headline.trim();
    if (profile?.bio !== undefined) mergedFreeform.bio = profile.bio.trim();
    if (profile?.communicationStyle !== undefined) {
      mergedFreeform.communicationStyle = profile.communicationStyle.trim();
    }
    if (profile?.avatarUrl !== undefined) mergedFreeform.avatarUrl = profile.avatarUrl.trim();

    const values =
      profile?.values !== undefined
        ? normalizeStringArray(profile.values)
        : normalizeStringArray(existingProfileDoc?.values);
    const boundaries =
      profile?.boundaries !== undefined
        ? normalizeStringArray(profile.boundaries)
        : normalizeStringArray(existingProfileDoc?.boundaries);
    const lifestyle =
      profile?.lifestyle !== undefined
        ? normalizeStringArray(profile.lifestyle)
        : normalizeStringArray(existingProfileDoc?.lifestyle);
    const interests =
      profile?.interests !== undefined
        ? normalizeStringArray(profile.interests)
        : normalizeStringArray(existingProfileDoc?.interests);
    const hobbies =
      profile?.hobbies !== undefined
        ? normalizeStringArray(profile.hobbies)
        : normalizeStringArray(existingProfileDoc?.hobbies);

    const mergedProfile: UserProfile = {
      userId,
      values,
      boundaries,
      lifestyle,
      interests,
      hobbies,
      freeformPreferences: mergedFreeform,
      speechStyleMarkers:
        (existingProfileDoc?.speechStyleMarkers as string[] | undefined) || [],
      upcomingDates: normalizeUpcomingDates(
        (existingProfileDoc as { upcomingDates?: unknown } | null)?.upcomingDates,
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await profileBuilder.buildProfileVector(mergedProfile);

    const nextDisplayName =
      (account?.displayName && account.displayName.trim()) ||
      mergedFreeform.name ||
      user.displayName ||
      "SoulBound User";
    user.displayName = nextDisplayName;
    await user.save();

    const snapshot = await buildProfileSnapshot(userId);
    if (!snapshot) {
      res.status(404).json({ error: "Profile not found after update" });
      return;
    }

    res.json({ saved: true, ...snapshot });
  } catch (error) {
    console.error("[Profile] Update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * POST /api/profile/upcoming-date
 * Saves an accepted match date to the user's profile.
 */
router.post("/upcoming-date", async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, withName, scheduledAt, place } = req.body as {
      userId?: string;
      sessionId?: string;
      withName?: string;
      scheduledAt?: string;
      place?: string;
    };

    if (!userId || !withName || !scheduledAt || !place) {
      res.status(400).json({ error: "userId, withName, scheduledAt, and place are required" });
      return;
    }

    const parsedScheduledAt = new Date(scheduledAt);
    if (Number.isNaN(parsedScheduledAt.getTime())) {
      res.status(400).json({ error: "scheduledAt must be a valid date" });
      return;
    }

    const newDate: UpcomingDate = {
      id: randomUUID(),
      sessionId,
      withName,
      scheduledAt: parsedScheduledAt,
      place,
      status: "scheduled",
      createdAt: new Date(),
    };

    const updatedProfile = await UserProfileModel.findOneAndUpdate(
      { userId },
      {
        $push: { upcomingDates: newDate },
      },
      { new: true },
    ).lean();

    if (!updatedProfile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json({
      saved: true,
      upcomingDate: newDate,
      upcomingDates: normalizeUpcomingDates((updatedProfile as { upcomingDates?: unknown }).upcomingDates),
    });
  } catch (error) {
    console.error("[Profile] Upcoming date save error:", error);
    res.status(500).json({ error: "Failed to save upcoming date" });
  }
});

export default router;
