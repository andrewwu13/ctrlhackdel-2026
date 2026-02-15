"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import { fetchBackend } from "@/lib/config";

type UpcomingDate = {
  id: string;
  sessionId?: string;
  withName: string;
  scheduledAt: string;
  place: string;
  status: "scheduled" | "declined";
  createdAt: string;
};

type UserSnapshot = {
  userId: string;
  account: {
    displayName: string;
    email: string | null;
    authProvider: string | null;
    avatarUrl: string | null;
  };
  profile: {
    name: string;
    headline: string;
    bio: string;
    communicationStyle: string;
    avatarUrl: string;
    values: string[];
    boundaries: string[];
    lifestyle: string[];
    interests: string[];
    hobbies: string[];
    upcomingDates: UpcomingDate[];
  };
};

type ProfileDraft = {
  displayName: string;
  name: string;
  headline: string;
  bio: string;
  communicationStyle: string;
  avatarUrl: string;
  valuesCsv: string;
  boundariesCsv: string;
  lifestyleCsv: string;
  interestsCsv: string;
  hobbiesCsv: string;
};

const hashSeed = (value: string) =>
  [...value].reduce((acc, char) => acc + char.charCodeAt(0), 0);

const initialsFromName = (name: string) => {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "SB";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
};

const faceColorFromSeed = (seed: number) => {
  const palette = [
    "from-rose-400/80 to-orange-300/80",
    "from-blue-400/80 to-cyan-300/80",
    "from-emerald-400/80 to-teal-300/80",
    "from-amber-400/80 to-red-300/80",
    "from-fuchsia-400/80 to-pink-300/80",
  ];
  return palette[Math.abs(seed) % palette.length];
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const csvToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const listToCsv = (value: string[]) => value.join(", ");

const buildDraftFromSnapshot = (snapshot: UserSnapshot): ProfileDraft => ({
  displayName: snapshot.account.displayName || "",
  name: snapshot.profile.name || "",
  headline: snapshot.profile.headline || "",
  bio: snapshot.profile.bio || "",
  communicationStyle: snapshot.profile.communicationStyle || "",
  avatarUrl: snapshot.account.avatarUrl || snapshot.profile.avatarUrl || "",
  valuesCsv: listToCsv(snapshot.profile.values || []),
  boundariesCsv: listToCsv(snapshot.profile.boundaries || []),
  lifestyleCsv: listToCsv(snapshot.profile.lifestyle || []),
  interestsCsv: listToCsv(snapshot.profile.interests || []),
  hobbiesCsv: listToCsv(snapshot.profile.hobbies || []),
});

const TagGroup = ({ title, items }: { title: string; items: string[] }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
      {title}
    </h3>
    <div className="flex flex-wrap gap-2">
      {items.length > 0 ? (
        items.map((item) => (
          <span
            key={`${title}-${item}`}
            className="rounded-full border border-border/60 bg-black/20 px-3 py-1 text-xs text-foreground"
          >
            {item}
          </span>
        ))
      ) : (
        <span className="text-xs text-muted-foreground">None added yet</span>
      )}
    </div>
  </section>
);

const ProfilePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const userId =
    searchParams?.get("userId") ||
    (typeof window !== "undefined" ? localStorage.getItem("soulbound_userId") : null);

  const [snapshot, setSnapshot] = useState<UserSnapshot | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const loadProfile = async () => {
    if (!userId) {
      setError("No signed-in user found. Please sign in first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchBackend(`/api/profile/me?userId=${encodeURIComponent(userId)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to fetch profile");
      }

      const nextSnapshot = payload as UserSnapshot;
      setSnapshot(nextSnapshot);
      setDraft(buildDraftFromSnapshot(nextSnapshot));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [userId]);

  const handleSave = async () => {
    if (!userId || !draft) return;

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const response = await fetchBackend("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          account: {
            displayName: draft.displayName,
          },
          profile: {
            name: draft.name,
            headline: draft.headline,
            bio: draft.bio,
            communicationStyle: draft.communicationStyle,
            avatarUrl: draft.avatarUrl,
            values: csvToList(draft.valuesCsv),
            boundaries: csvToList(draft.boundariesCsv),
            lifestyle: csvToList(draft.lifestyleCsv),
            interests: csvToList(draft.interestsCsv),
            hobbies: csvToList(draft.hobbiesCsv),
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save profile");
      }

      const updatedSnapshot = payload as UserSnapshot;
      setSnapshot(updatedSnapshot);
      setDraft(buildDraftFromSnapshot(updatedSnapshot));
      setIsEditing(false);
      setSaveMessage("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => {
    if (!snapshot) return;
    setDraft(buildDraftFromSnapshot(snapshot));
    setIsEditing(false);
    setSaveMessage("");
    setError("");
  };

  const displayName = draft?.displayName || snapshot?.account.displayName || "SoulBound User";
  const avatarUrl = draft?.avatarUrl || snapshot?.account.avatarUrl || snapshot?.profile.avatarUrl || "";
  const avatarSeed = useMemo(() => hashSeed(displayName), [displayName]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="glass-strong rounded-2xl p-4 md:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-full object-cover border border-border/50"
                />
              ) : (
                <div
                  className={`h-14 w-14 rounded-full bg-gradient-to-br ${faceColorFromSeed(avatarSeed)} flex items-center justify-center text-lg font-black text-white`}
                >
                  {initialsFromName(displayName)}
                </div>
              )}

              <div>
                <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                  {displayName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {snapshot?.account.email || "No email linked"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(`/lounge${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`)
                }
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Back to Lounge
              </button>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted/30"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted/30"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground animate-pulse">Loading profile...</p>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {saveMessage && (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {saveMessage}
            </div>
          )}

          {!loading && snapshot && draft && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {!isEditing ? (
                <>
                  <section className="space-y-2">
                    <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      Profile Summary
                    </h2>
                    <div className="rounded-xl border border-border/60 bg-black/20 p-4 space-y-2">
                      <p className="text-lg font-semibold text-foreground">
                        {snapshot.profile.headline || "No headline yet"}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {snapshot.profile.bio || "No bio yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Communication style: {snapshot.profile.communicationStyle || "Not set"}
                      </p>
                    </div>
                  </section>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TagGroup title="Values" items={snapshot.profile.values} />
                    <TagGroup title="Boundaries" items={snapshot.profile.boundaries} />
                    <TagGroup title="Lifestyle" items={snapshot.profile.lifestyle} />
                    <TagGroup title="Interests" items={snapshot.profile.interests} />
                    <TagGroup title="Hobbies" items={snapshot.profile.hobbies} />
                  </div>
                </>
              ) : (
                <section className="space-y-3">
                  <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    Edit Profile
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={draft.displayName}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, displayName: e.target.value } : prev))}
                      placeholder="Display name"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
                    />
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                      placeholder="Profile name"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
                    />
                    <input
                      value={draft.headline}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, headline: e.target.value } : prev))}
                      placeholder="Headline"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm md:col-span-2"
                    />
                    <input
                      value={draft.avatarUrl}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, avatarUrl: e.target.value } : prev))}
                      placeholder="Profile picture URL (https://...)"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm md:col-span-2"
                    />
                    <textarea
                      value={draft.bio}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
                      placeholder="Bio"
                      className="min-h-24 rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm md:col-span-2"
                    />
                    <input
                      value={draft.communicationStyle}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, communicationStyle: e.target.value } : prev))}
                      placeholder="Communication style"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm md:col-span-2"
                    />
                    <input
                      value={draft.valuesCsv}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, valuesCsv: e.target.value } : prev))}
                      placeholder="Values (comma separated)"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
                    />
                    <input
                      value={draft.boundariesCsv}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, boundariesCsv: e.target.value } : prev))}
                      placeholder="Boundaries (comma separated)"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
                    />
                    <input
                      value={draft.lifestyleCsv}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, lifestyleCsv: e.target.value } : prev))}
                      placeholder="Lifestyle (comma separated)"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
                    />
                    <input
                      value={draft.interestsCsv}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, interestsCsv: e.target.value } : prev))}
                      placeholder="Interests (comma separated)"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
                    />
                    <input
                      value={draft.hobbiesCsv}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, hobbiesCsv: e.target.value } : prev))}
                      placeholder="Hobbies (comma separated)"
                      className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm md:col-span-2"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSave()}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Upcoming Dates
                </h2>

                {snapshot.profile.upcomingDates.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-black/20 p-4 text-sm text-muted-foreground">
                    No upcoming dates yet. When a conversation crosses the compatibility threshold,
                    you can schedule from the lounge and it will appear here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {snapshot.profile.upcomingDates.map((date) => (
                      <div
                        key={date.id}
                        className="rounded-xl border border-border/60 bg-black/20 p-4"
                      >
                        <p className="text-sm font-semibold text-foreground">With {date.withName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(date.scheduledAt)} at {date.place}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
