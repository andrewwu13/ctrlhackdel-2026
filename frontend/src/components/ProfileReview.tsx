import { motion } from "framer-motion";
import { Check, Loader2, RefreshCw } from "lucide-react";
import type { GeneratedProfile, PersonalitySliders } from "@/hooks/types";

type ProfileReviewProps = {
  profile: GeneratedProfile;
  personality: PersonalitySliders;
  verified: boolean;
  isGeneratingProfile: boolean;
  generationError: string;
  canLaunch: boolean;
  isLaunching: boolean;
  launchError: string;
  onProfileChange: (profile: GeneratedProfile) => void;
  onPersonalityChange: (personality: PersonalitySliders) => void;
  onVerifiedChange: (verified: boolean) => void;
  onRegenerate: () => Promise<void>;
  onLaunch: () => void | Promise<void>;
  onUpdateListField: (
    field:
      | "coreValues"
      | "goals"
      | "dealbreakers"
      | "interests"
      | "hobbies"
      | "lifestyle",
    value: string,
  ) => void;
};

// ── Slider Component ───────────────────────────────────────────────

const PersonalitySlider = ({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{lowLabel}</span>
      <span className="font-medium text-foreground">{label}</span>
      <span>{highLabel}</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
    />
  </div>
);

// ── Lifestyle Chips ────────────────────────────────────────────────

const LIFESTYLE_OPTIONS = [
  "Active",
  "Homebody",
  "Adventurous",
  "Social butterfly",
  "Creative",
  "Outdoorsy",
  "Night owl",
  "Early bird",
  "Foodie",
  "Minimalist",
  "Spiritual",
  "Career-driven",
];

const LifestyleChips = ({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (lifestyle: string[]) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {LIFESTYLE_OPTIONS.map((option) => {
      const isSelected = selected.includes(option);
      return (
        <button
          key={option}
          type="button"
          onClick={() =>
            onChange(
              isSelected
                ? selected.filter((s) => s !== option)
                : [...selected, option],
            )
          }
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isSelected
              ? "bg-primary/30 text-primary border border-primary/40"
              : "bg-muted/30 text-muted-foreground border border-border/30 hover:border-primary/30"
          }`}
        >
          {isSelected ? "✓ " : ""}
          {option}
        </button>
      );
    })}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────

const ProfileReview = ({
  profile,
  personality,
  verified,
  isGeneratingProfile,
  generationError,
  canLaunch,
  isLaunching,
  launchError,
  onProfileChange,
  onPersonalityChange,
  onVerifiedChange,
  onRegenerate,
  onLaunch,
  onUpdateListField,
}: ProfileReviewProps) => (
  <motion.div
    key="profile-review"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-strong rounded-2xl p-6 md:p-8 space-y-6 max-w-3xl mx-auto w-full max-h-[90vh] overflow-y-auto"
  >
    <div className="space-y-2">
      <h2 className="font-display text-3xl font-bold text-foreground">
        Your <span className="text-gradient-rose">Agent Profile</span>
      </h2>
      <p className="text-muted-foreground text-sm">
        Review and fine-tune your profile. Add interests, adjust personality
        sliders, and pick your lifestyle tags.
      </p>
    </div>

    {generationError && (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-300">
        Fallback used: {generationError}
      </div>
    )}

    {/* ── Identity ────────────────────────────────────────────── */}
    <section className="space-y-3">
      <h3 className="text-sm font-mono uppercase tracking-wider text-accent">
        Identity
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={profile.name}
          onChange={(e) =>
            onProfileChange({ ...profile, name: e.target.value })
          }
          placeholder="Name"
          className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
        />
        <input
          value={profile.headline}
          onChange={(e) =>
            onProfileChange({ ...profile, headline: e.target.value })
          }
          placeholder="Headline"
          className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
        />
      </div>
      <textarea
        value={profile.bio}
        onChange={(e) =>
          onProfileChange({ ...profile, bio: e.target.value })
        }
        placeholder="Bio"
        className="w-full min-h-24 rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
    </section>

    {/* ── Personality Sliders ─────────────────────────────────── */}
    <section className="space-y-3">
      <h3 className="text-sm font-mono uppercase tracking-wider text-accent">
        Personality
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PersonalitySlider
          label="Openness"
          lowLabel="Traditional"
          highLabel="Exploratory"
          value={personality.openness}
          onChange={(v) =>
            onPersonalityChange({ ...personality, openness: v })
          }
        />
        <PersonalitySlider
          label="Extraversion"
          lowLabel="Introverted"
          highLabel="Extroverted"
          value={personality.extraversion}
          onChange={(v) =>
            onPersonalityChange({ ...personality, extraversion: v })
          }
        />
        <PersonalitySlider
          label="Agreeableness"
          lowLabel="Independent"
          highLabel="Collaborative"
          value={personality.agreeableness}
          onChange={(v) =>
            onPersonalityChange({ ...personality, agreeableness: v })
          }
        />
        <PersonalitySlider
          label="Emotional Stability"
          lowLabel="Sensitive"
          highLabel="Resilient"
          value={personality.emotionalStability}
          onChange={(v) =>
            onPersonalityChange({ ...personality, emotionalStability: v })
          }
        />
      </div>
    </section>

    {/* ── Values & Goals ──────────────────────────────────────── */}
    <section className="space-y-3">
      <h3 className="text-sm font-mono uppercase tracking-wider text-accent">
        Values & Goals
      </h3>
      <input
        value={profile.coreValues.join(", ")}
        onChange={(e) => onUpdateListField("coreValues", e.target.value)}
        placeholder="Core values (comma separated)"
        className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
      <input
        value={profile.goals.join(", ")}
        onChange={(e) => onUpdateListField("goals", e.target.value)}
        placeholder="Goals (comma separated)"
        className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
      <input
        value={profile.dealbreakers.join(", ")}
        onChange={(e) => onUpdateListField("dealbreakers", e.target.value)}
        placeholder="Dealbreakers (comma separated)"
        className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
    </section>

    {/* ── Interests & Hobbies ─────────────────────────────────── */}
    <section className="space-y-3">
      <h3 className="text-sm font-mono uppercase tracking-wider text-accent">
        Interests & Hobbies
      </h3>
      <input
        value={profile.interests.join(", ")}
        onChange={(e) => onUpdateListField("interests", e.target.value)}
        placeholder="Interests (comma separated)"
        className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
      <input
        value={profile.hobbies.join(", ")}
        onChange={(e) => onUpdateListField("hobbies", e.target.value)}
        placeholder="Hobbies (comma separated)"
        className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
    </section>

    {/* ── Communication & Lifestyle ───────────────────────────── */}
    <section className="space-y-3">
      <h3 className="text-sm font-mono uppercase tracking-wider text-accent">
        Communication & Lifestyle
      </h3>
      <input
        value={profile.communicationStyle}
        onChange={(e) =>
          onProfileChange({
            ...profile,
            communicationStyle: e.target.value,
          })
        }
        placeholder="Communication style"
        className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
      />
      <LifestyleChips
        selected={profile.lifestyle}
        onChange={(lifestyle) => onProfileChange({ ...profile, lifestyle })}
      />
    </section>

    {/* ── Actions ─────────────────────────────────────────────── */}
    <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer select-none">
      <input
        type="checkbox"
        checked={verified}
        onChange={(e) => onVerifiedChange(e.target.checked)}
        className="w-4 h-4"
      />
      I verify this profile is accurate and ready for agent launch.
    </label>

    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <button
        onClick={onRegenerate}
        disabled={isGeneratingProfile}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
        disabled={!canLaunch || isLaunching}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
      >
        {isLaunching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        {isLaunching ? "Saving Profile..." : "Save Profile & Continue"}
      </button>
    </div>

    {launchError && (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {launchError}
      </div>
    )}
  </motion.div>
);

export default ProfileReview;
