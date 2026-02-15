/**
 * Shared types for the onboarding conversation flow.
 */

export type ConversationMessage = {
  role: "user" | "agent";
  content: string;
  timestamp: number;
};

export type CoreTopic =
  | "values"
  | "boundaries"
  | "lifestyle"
  | "communication"
  | "goals"
  | "dealbreakers";

export type GeneratedProfile = {
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

export type PersonalitySliders = {
  openness: number;
  extraversion: number;
  agreeableness: number;
  emotionalStability: number;
};

export type AgentMode =
  | "booting"
  | "speaking"
  | "listening"
  | "thinking"
  | "generating"
  | "review";
