"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import AgentAvatar from "@/components/AgentAvatar";
import ProfileReview from "@/components/ProfileReview";
import { useConversationFlow } from "@/hooks/useInterviewFlow";
import { BACKEND_URL } from "@/lib/config";
import type { GeneratedProfile, ConversationMessage, CoreTopic } from "@/hooks/types";

// ── Backend API Calls ──────────────────────────────────────────────

const synthesizeAudio = async (text: string): Promise<Blob | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    return response.blob();
  } catch {
    return null;
  }
};

const converseWithAgent = async (
  transcript: string,
  history: ConversationMessage[],
): Promise<{ agentText: string; topicsCovered: CoreTopic[]; isComplete: boolean }> => {
  const response = await fetch(`${BACKEND_URL}/api/onboarding/converse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, history }),
  });
  if (!response.ok) throw new Error("Conversation request failed");
  return response.json();
};

const generateProfileFromBackend = async (
  answers: string[],
): Promise<GeneratedProfile> => {
  const response = await fetch(`${BACKEND_URL}/api/profile/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw new Error("Profile generation failed");
  const data = await response.json();
  if (data.userId) localStorage.setItem("soulbound_userId", data.userId);
  return {
    ...data.profile,
    interests: data.profile?.interests || [],
    hobbies: data.profile?.hobbies || [],
    lifestyle: data.profile?.lifestyle || [],
  } as GeneratedProfile;
};

// ── Topic label map ────────────────────────────────────────────────

const TOPIC_LABELS: Record<string, string> = {
  values: "Values",
  boundaries: "Boundaries",
  lifestyle: "Lifestyle",
  communication: "Communication",
  goals: "Goals",
  dealbreakers: "Dealbreakers",
};

// ── Component ──────────────────────────────────────────────────────

const Onboarding = () => {
  const router = useRouter();
  const [userId] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("soulbound_userId")
      : null,
  );

  const flow = useConversationFlow(
    synthesizeAudio,
    converseWithAgent,
    generateProfileFromBackend,
  );

  const handleLaunch = useCallback(() => {
    const storedUserId = localStorage.getItem("soulbound_userId");
    const uid = storedUserId || userId;
    router.push(`/lounge${uid ? `?userId=${uid}` : ""}`);
  }, [router, userId]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 min-h-screen px-4 py-6 flex items-center justify-center">
        {!flow.profileReady ? (
          <div className="w-full max-w-4xl space-y-6">
            {/* Header */}
            <div className="text-center space-y-1">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                Meet Your{" "}
                <span className="text-gradient-rose">Soul Agent</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Just talk naturally — your agent will learn who you are.
              </p>
            </div>

            {/* Avatar */}
            <div className="flex justify-center">
              <AgentAvatar
                mode={flow.mode === "review" ? "thinking" : flow.mode}
              />
            </div>

            {/* Topic chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {flow.allTopics.map((topic) => {
                const covered = flow.topicsCovered.includes(topic);
                return (
                  <span
                    key={topic}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                      covered
                        ? "bg-primary/30 text-primary border border-primary/40"
                        : "bg-muted/30 text-muted-foreground border border-border/30"
                    }`}
                  >
                    {covered ? "✓ " : ""}
                    {TOPIC_LABELS[topic]}
                  </span>
                );
              })}
            </div>

            {/* Conversation panel */}
            <motion.div
              className="glass-strong rounded-2xl overflow-hidden max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Chat transcript */}
              <div className="max-h-48 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {flow.messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary/20 text-foreground rounded-tr-sm"
                            : "bg-muted/40 text-foreground rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Current state bar */}
              <div className="border-t border-border/20 px-4 py-3 text-center space-y-2">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
                  {flow.modeLabel}
                </p>

                {/* Agent's current line (when speaking/thinking) */}
                {flow.agentLine && flow.mode !== "listening" && (
                  <p className="text-foreground text-base leading-relaxed">
                    {flow.agentLine}
                  </p>
                )}

                {/* Live transcript while user is speaking */}
                {flow.mode === "listening" && flow.liveTranscript && (
                  <p className="text-foreground/70 text-sm italic">
                    &ldquo;{flow.liveTranscript}&rdquo;
                  </p>
                )}

                {flow.mode === "listening" && !flow.liveTranscript && (
                  <p className="text-muted-foreground text-sm">
                    Go ahead, I&apos;m listening...
                  </p>
                )}
              </div>

              {/* Errors */}
              {(flow.voiceError || flow.speechError) && (
                <div className="px-4 pb-3">
                  {flow.voiceError && (
                    <p className="text-xs text-destructive">
                      {flow.voiceError}
                    </p>
                  )}
                  {flow.speechError && (
                    <p className="text-xs text-destructive">
                      {flow.speechError}
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            {!flow.isSpeechSupported && (
              <p className="text-center text-sm text-destructive">
                Speech recognition requires Chrome or Edge.
              </p>
            )}
          </div>
        ) : (
          <ProfileReview
            profile={flow.profile}
            personality={flow.personality}
            verified={flow.verified}
            isGeneratingProfile={flow.isGeneratingProfile}
            generationError={flow.generationError}
            canLaunch={flow.canLaunch}
            onProfileChange={flow.setProfile}
            onPersonalityChange={flow.setPersonality}
            onVerifiedChange={flow.setVerified}
            onRegenerate={flow.regenerateProfile}
            onLaunch={handleLaunch}
            onUpdateListField={flow.updateListField}
          />
        )}
      </div>
    </div>
  );
};

export default Onboarding;
