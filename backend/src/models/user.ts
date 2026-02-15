
import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {},
  {
    timestamps: true,
  }
);



export const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);


// ── Restored Interfaces ──────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  // Core questions (hard-coded during onboarding)
  values: string[];
  boundaries: string[];
  lifestyle: string[];
  // Free-form preferences (from dynamic conversation)
  interests: string[];
  hobbies: string[];
  freeformPreferences: Record<string, string>;
  // Speech style markers (extracted from ElevenLabs STT)
  speechStyleMarkers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalityVector {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface ProfileVector {
  userId: string;
  // Dense embedding of profile text
  embedding: number[];
  // Big-5 personality vector
  personality: PersonalityVector;
  // Hard filters (must-match boolean gates)
  hardFilters: Record<string, string | boolean>;
  // Soft filters (preference weights)
  softFilters: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

