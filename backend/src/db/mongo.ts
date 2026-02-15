import mongoose from "mongoose";
import { config } from "../config";

// ── MongoDB Connection ─────────────────────────────────────────────

let isConnected = false;

export async function connectMongo(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(config.mongoUri);
    isConnected = true;
    console.log("[MongoDB] Connected successfully");
  } catch (error) {
    console.error("[MongoDB] Connection error:", error);
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (!isConnected) return;

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("[MongoDB] Disconnected");
  } catch (error) {
    console.error("[MongoDB] Disconnect error:", error);
  }
}

// ── Mongoose Schemas ───────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleSub: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ["password", "google", "hybrid"] },
    displayName: { type: String, trim: true },
    accountCreatedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    displayName: { type: String, trim: true },
    headline: { type: String, trim: true },
    bio: { type: String, trim: true },
    values: [String],
    boundaries: [String],
    lifestyle: [String],
    interests: [String],
    hobbies: [String],
    freeformPreferences: { type: Map, of: String },
    speechStyleMarkers: [String],
    upcomingDates: [
      {
        id: { type: String, required: true },
        sessionId: { type: String },
        withName: { type: String, required: true },
        scheduledAt: { type: Date, required: true },
        place: { type: String, required: true },
        status: {
          type: String,
          enum: ["scheduled", "declined"],
          default: "scheduled",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const profileVectorSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    displayName: { type: String, trim: true },
    bio: { type: String, trim: true },
    embedding: [Number],
    personality: {
      openness: Number,
      conscientiousness: Number,
      extraversion: Number,
      agreeableness: Number,
      neuroticism: Number,
    },
    hardFilters: { type: Map, of: mongoose.Schema.Types.Mixed },
    softFilters: { type: Map, of: Number },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userAId: { type: String, required: true },
    userBId: { type: String, required: true },
    state: {
      type: String,
      enum: ["INIT", "LIVE", "WRAP", "SCORE"],
      default: "INIT",
    },
    messages: [
      {
        id: String,
        sender: String,
        content: String,
        timestamp: Date,
        sentiment: Number,
        topicEmbedding: [Number],
        tokenCount: Number,
      },
    ],
    startedAt: Date,
    endedAt: Date,
    elapsedSeconds: Number,
  },
  { timestamps: true }
);

const compatibilityResultSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    compatibilityScore: Number,
    breakdown: {
      preConversation: Number,
      personality: Number,
      flow: Number,
      topic: Number,
    },
    hardConstraintPassed: Boolean,
    trendOverTime: [Number],
    recommendMatch: Boolean,
    computedAt: Date,
  },
  { timestamps: true }
);

// ── Models ─────────────────────────────────────────────────────────

export const UserModel = mongoose.model("User", userSchema);
export const UserProfileModel = mongoose.model("UserProfile", userProfileSchema);
export const ProfileVectorModel = mongoose.model("ProfileVector", profileVectorSchema);
export const ConversationModel = mongoose.model("Conversation", conversationSchema);
export const CompatibilityResultModel = mongoose.model(
  "CompatibilityResult",
  compatibilityResultSchema
);
