import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import AgentAvatar from "@/components/AgentAvatar";
import ProfileReview from "@/components/ProfileReview";
import { useInterviewFlow } from "@/hooks/useInterviewFlow";
import { BACKEND_URL } from "@/lib/config";
import type { GeneratedProfile } from "@/hooks/types";

// ── Backend API Calls ──────────────────────────────────────────────
// All external API calls go through the backend — no API keys in the frontend.

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

const generateProfileFromBackend = async (
  answers: string[],
): Promise<GeneratedProfile> => {
  const response = await fetch(`${BACKEND_URL}/api/profile/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Profile generation failed: ${err}`);
  }

  const data = await response.json();

  // Store userId for later use (match initiation)
  if (data.userId) {
    localStorage.setItem("soulbound_userId", data.userId);
  }

  return data.profile as GeneratedProfile;
};

// ── Component ──────────────────────────────────────────────────────

const Onboarding = () => {
  const navigate = useNavigate();
  const [userId] = useState(() => localStorage.getItem("soulbound_userId"));

  const flow = useInterviewFlow(synthesizeAudio, generateProfileFromBackend);

  const handleLaunch = useCallback(() => {
    const storedUserId = localStorage.getItem("soulbound_userId");
    navigate("/lounge", { state: { userId: storedUserId || userId } });
  }, [navigate, userId]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 min-h-screen px-4 py-8 flex items-center justify-center">
        {!flow.profileReady ? (
          <div className="w-full max-w-4xl space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
                Live{" "}
                <span className="text-gradient-rose">Agent Interview</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                No forms. No chat controls. Just live voice conversation.
              </p>
            </div>

            {/* Avatar */}
            <div className="flex justify-center">
              <AgentAvatar
                mode={flow.mode === "review" ? "thinking" : flow.mode}
              />
            </div>

            {/* Interview panel */}
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl mx-auto text-center space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-mono uppercase tracking-[0.22em] text-accent">
                {flow.modeLabel}
              </p>
              <p className="text-foreground text-lg md:text-xl leading-relaxed">
                {flow.agentLine}
              </p>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(flow.questionIndex / flow.totalQuestions) * 100}%`,
                  }}
                  transition={{ duration: 0.35 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Question{" "}
                {Math.min(flow.questionIndex + 1, flow.totalQuestions)} /{" "}
                {flow.totalQuestions}
              </p>

              {/* Errors */}
              {flow.voiceError ? (
                <p className="text-sm text-destructive">{flow.voiceError}</p>
              ) : null}
              {flow.speechError ? (
                <p className="text-sm text-destructive">{flow.speechError}</p>
              ) : null}
              {!flow.isSpeechSupported ? (
                <p className="text-sm text-destructive">
                  Speech recognition requires Chrome or Edge.
                </p>
              ) : null}
            </motion.div>
          </div>
        ) : (
          <ProfileReview
            profile={flow.profile}
            verified={flow.verified}
            isGeneratingProfile={flow.isGeneratingProfile}
            generationError={flow.generationError}
            canLaunch={flow.canLaunch}
            onProfileChange={flow.setProfile}
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
