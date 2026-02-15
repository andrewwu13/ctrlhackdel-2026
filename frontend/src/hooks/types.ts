/**
 * Shared types for the onboarding interview flow.
 */

export type InterviewQuestion = {
  id: string;
  section: "Soul Vector" | "Voice Imprint";
  prompt: string;
};

export type GeneratedProfile = {
  name: string;
  headline: string;
  bio: string;
  coreValues: string[];
  communicationStyle: string;
  goals: string[];
  dealbreakers: string[];
};

export type AgentMode =
  | "booting"
  | "speaking"
  | "listening"
  | "thinking"
  | "generating"
  | "review";
