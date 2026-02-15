import { motion } from "framer-motion";
import { Check, Loader2, RefreshCw } from "lucide-react";
import type { GeneratedProfile } from "@/hooks/types";

type ProfileReviewProps = {
  profile: GeneratedProfile;
  verified: boolean;
  isGeneratingProfile: boolean;
  generationError: string;
  canLaunch: boolean;
  onProfileChange: (profile: GeneratedProfile) => void;
  onVerifiedChange: (verified: boolean) => void;
  onRegenerate: () => Promise<void>;
  onLaunch: () => void;
  onUpdateListField: (
    field: "coreValues" | "goals" | "dealbreakers",
    value: string,
  ) => void;
};

const ProfileReview = ({
  profile,
  verified,
  isGeneratingProfile,
  generationError,
  canLaunch,
  onProfileChange,
  onVerifiedChange,
  onRegenerate,
  onLaunch,
  onUpdateListField,
}: ProfileReviewProps) => (
  <motion.div
    key="profile-review"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-strong rounded-2xl p-6 md:p-8 space-y-5 max-w-3xl mx-auto w-full"
  >
    <div className="space-y-2">
      <h2 className="font-display text-3xl font-bold text-foreground">
        Review Your <span className="text-gradient-rose">Agent Profile</span>
      </h2>
      <p className="text-muted-foreground">
        Verify or edit details below, then launch your agent.
      </p>
    </div>

    {generationError && (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-300">
        API fallback used: {generationError}
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input
        value={profile.name}
        onChange={(e) =>
          onProfileChange({ ...profile, name: e.target.value })
        }
        placeholder="Name"
        className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
      />
      <input
        value={profile.headline}
        onChange={(e) =>
          onProfileChange({ ...profile, headline: e.target.value })
        }
        placeholder="Headline"
        className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
      />
    </div>

    <textarea
      value={profile.bio}
      onChange={(e) =>
        onProfileChange({ ...profile, bio: e.target.value })
      }
      placeholder="Bio"
      className="w-full min-h-28 rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
    />

    <input
      value={profile.coreValues.join(", ")}
      onChange={(e) => onUpdateListField("coreValues", e.target.value)}
      placeholder="Core values (comma separated)"
      className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
    />

    <input
      value={profile.communicationStyle}
      onChange={(e) =>
        onProfileChange({
          ...profile,
          communicationStyle: e.target.value,
        })
      }
      placeholder="Communication style"
      className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
    />

    <input
      value={profile.goals.join(", ")}
      onChange={(e) => onUpdateListField("goals", e.target.value)}
      placeholder="Goals (comma separated)"
      className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
    />

    <input
      value={profile.dealbreakers.join(", ")}
      onChange={(e) => onUpdateListField("dealbreakers", e.target.value)}
      placeholder="Dealbreakers (comma separated)"
      className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
    />

    <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer select-none">
      <input
        type="checkbox"
        checked={verified}
        onChange={(e) => onVerifiedChange(e.target.checked)}
        className="w-4 h-4"
      />
      I verify this profile is accurate and ready for agent launch.
    </label>

    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <button
        onClick={onRegenerate}
        disabled={isGeneratingProfile}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGeneratingProfile ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        Regenerate
      </button>

      <button
        onClick={onLaunch}
        disabled={!canLaunch}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
      >
        <Check className="w-4 h-4" />
        Launch Your Agent
      </button>
    </div>
  </motion.div>
);

export default ProfileReview;
