// ── Shared TypeScript Types (mirrors backend models) ───────────────

// ── User & Profile ────────────────────────────────────────────────

export interface User {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  values: string[];
  boundaries: string[];
  lifestyle: string[];
  interests: string[];
  hobbies: string[];
  freeformPreferences: Record<string, string>;
  speechStyleMarkers?: string[];
  createdAt: string;
  updatedAt: string;
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
  embedding: number[];
  personality: PersonalityVector;
  hardFilters: Record<string, string | boolean>;
  softFilters: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

// ── Conversation ──────────────────────────────────────────────────

export type ConversationState = "INIT" | "LIVE" | "WRAP" | "SCORE";

export interface Message {
  id: string;
  sessionId: string;
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  timestamp: string;
  sentiment?: number;
  topicEmbedding?: number[];
  tokenCount?: number;
}

export interface ConversationSession {
  id: string;
  userAId: string;
  userBId: string;
  state: ConversationState;
  messages: Message[];
  startedAt: string;
  endedAt?: string;
  elapsedSeconds: number;
}

// ── Compatibility ─────────────────────────────────────────────────

export interface ScoreBreakdown {
  preConversation: number;
  personality: number;
  flow: number;
  topic: number;
}

export interface CompatibilityResult {
  sessionId: string;
  compatibilityScore: number;
  breakdown: ScoreBreakdown;
  hardConstraintPassed: boolean;
  trendOverTime: number[];
  recommendMatch: boolean;
  computedAt: string;
}

// ── Socket Events ─────────────────────────────────────────────────

export interface OnboardingQuestion {
  index: number;
  text: string;
  total: number;
}

export interface CompatibilityUpdate {
  score: number;
  breakdown: ScoreBreakdown;
}
