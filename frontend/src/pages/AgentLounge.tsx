"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import AgentAvatar from "@/components/AgentAvatar";
import { fetchBackend, getBackendUrl } from "@/lib/config";

type ChatMessage = {
  id: string;
  sender: "agent_a" | "agent_b";
  content: string;
  timestamp: string;
};

type ScoreBreakdown = {
  preConversation?: number;
  personality?: number;
  flow?: number;
  topic?: number;
};

type ConversationResult = {
  compatibilityScore: number;
  breakdown: ScoreBreakdown;
  recommendMatch: boolean;
  trendOverTime: number[];
};

type ConversationState = "INIT" | "LIVE" | "WRAP" | "SCORE";

type SuggestedDate = {
  scheduledAt: string;
  place: string;
};

type MatchPersona = {
  id: string;
  name: string;
  gender: "female" | "male";
  avatarSeed: number;
};

type UpcomingDate = {
  id: string;
  sessionId?: string;
  withName: string;
  scheduledAt: string;
  place: string;
  status: "scheduled" | "declined";
  createdAt: string;
};

type MatchCandidate = {
  userId: string;
  preScore: number;
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
  suggestedMatchPersona: MatchPersona;
};

type LoungeConversation = {
  sessionId: string;
  label: string;
  peerLabel: string;
  peerAvatarSeed: number;
  state: ConversationState;
  messages: ChatMessage[];
  score: number;
  scoreSeries: number[];
  breakdown: ScoreBreakdown;
  elapsed: number;
  connecting: boolean;
  myAgentActive: boolean;
  peerAgentReady: boolean;
  result: ConversationResult | null;
  error: string;
  unread: number;
  dateSuggestion: SuggestedDate | null;
  scheduleStatus: "idle" | "saving" | "saved" | "declined";
  scheduleError: string;
};

const TOTAL_DURATION_SECONDS = 180;
const MAX_SERIES_POINTS = 90;
const MATCH_THRESHOLD = 65;

const toPercent = (value?: number): number => {
  if (value == null || Number.isNaN(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
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

const formatTime = (seconds: number) => {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

const formatMessageTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const stateLabel = (state: ConversationState) => {
  if (state === "INIT") return "Initializing";
  if (state === "LIVE") return "Live";
  if (state === "WRAP") return "Wrapping";
  return "Complete";
};

const appendScore = (series: number[], score: number) => {
  const next = [...series, score];
  return next.slice(Math.max(0, next.length - MAX_SERIES_POINTS));
};

const generateDateSuggestion = (seedKey: string): SuggestedDate => {
  const places = [
    "Bluebird Coffee House",
    "Central Park Walk + Coffee",
    "Moonlight Bistro",
    "Riverside Art Gallery",
    "Sunset Terrace Cafe",
  ];

  const seed = hashSeed(seedKey);
  const place = places[seed % places.length];

  const now = new Date();
  const target = new Date(now);
  const targetDay = 5; // Friday
  const dayDiff = (targetDay - target.getDay() + 7) % 7 || 7;
  target.setDate(target.getDate() + dayDiff);
  target.setHours(19, 0, 0, 0);

  return {
    place,
    scheduledAt: target.toISOString(),
  };
};

const MiniFace = ({
  name,
  seed,
  avatarUrl,
  size = "md",
}: {
  name: string;
  seed: number;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) => {
  const dimensions = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${dimensions} rounded-full object-cover border border-border/50`}
        title={name}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br ${faceColorFromSeed(seed)} ${dimensions} flex items-center justify-center font-bold text-white shadow-sm`}
      title={name}
    >
      {initialsFromName(name)}
    </div>
  );
};

const TrendGraph = ({
  series,
  colorClass,
}: {
  series: number[];
  colorClass: string;
}) => {
  const points = series.length > 0 ? series : [0];
  const polyline = points
    .map((value, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 100 - Math.max(0, Math.min(100, value));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-48 w-full rounded-xl border border-border/50 bg-black/20 p-3">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <line x1="0" y1="25" x2="100" y2="25" className="stroke-border/40" strokeWidth="0.8" />
        <line x1="0" y1="50" x2="100" y2="50" className="stroke-border/40" strokeWidth="0.8" />
        <line x1="0" y1="75" x2="100" y2="75" className="stroke-border/40" strokeWidth="0.8" />
        <polyline
          fill="none"
          points={polyline}
          className={colorClass}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const STORAGE_KEY = "soulbound_lounge_state";

const AgentLounge = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketsRef = useRef<Record<string, Socket>>({});
  const activeConversationIdRef = useRef<string | null>(null);
  const conversationCounterRef = useRef(1);

  const userId =
    searchParams?.get("userId") ||
    (typeof window !== "undefined" ? localStorage.getItem("soulbound_userId") : null);

  // Restore persisted state from sessionStorage
  const restoredState = useMemo(() => {
    if (typeof window === "undefined" || !userId) return null;
    try {
      const raw = sessionStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Mark any in-flight conversations as ended (sockets are gone)
      const convs = (parsed.conversations || []).map((c: LoungeConversation) => ({
        ...c,
        state: (c.state === "LIVE" || c.state === "WRAP") ? "SCORE" as ConversationState : c.state,
        connecting: false,
      }));
      return {
        conversations: convs as LoungeConversation[],
        activeConversationId: parsed.activeConversationId as string | null,
        matchedUserIds: new Set<string>(parsed.matchedUserIds || []),
        counter: parsed.counter || 1,
      };
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [conversations, setConversations] = useState<LoungeConversation[]>(
    restoredState?.conversations ?? []
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    restoredState?.activeConversationId ?? null
  );
  const [globalError, setGlobalError] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userSnapshot, setUserSnapshot] = useState<UserSnapshot | null>(null);
  const [candidateQueue, setCandidateQueue] = useState<MatchCandidate[]>([]);
  const [matchedUserIds, setMatchedUserIds] = useState<Set<string>>(
    restoredState?.matchedUserIds ?? new Set()
  );

  // Restore counter ref
  if (restoredState?.counter) {
    conversationCounterRef.current = restoredState.counter;
  }

  const backendUrl = useMemo(() => getBackendUrl(), []);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    if (!userId) return;
    try {
      const payload = {
        conversations,
        activeConversationId,
        matchedUserIds: Array.from(matchedUserIds),
        counter: conversationCounterRef.current,
      };
      sessionStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(payload));
    } catch {
      // sessionStorage quota exceeded — ignore silently
    }
  }, [conversations, activeConversationId, matchedUserIds, userId]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.sessionId === activeConversationId) ??
      null,
    [activeConversationId, conversations],
  );

  const updateConversation = useCallback(
    (
      sessionId: string,
      updater: (conversation: LoungeConversation) => LoungeConversation,
    ) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.sessionId === sessionId
            ? updater(conversation)
            : conversation,
        ),
      );
    },
    [],
  );

  const loadUserSnapshot = useCallback(async () => {
    if (!userId) {
      setGlobalError("No user profile found. Please complete onboarding first.");
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);

    try {
      const response = await fetchBackend(`/api/profile/me?userId=${encodeURIComponent(userId)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load your profile");
      }

      setUserSnapshot(payload as UserSnapshot);
      setGlobalError("");
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Failed to load profile");
    } finally {
      setIsLoadingProfile(false);
    }
  }, [userId]);

  // Load ranked candidates on mount
  const loadCandidates = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetchBackend(`/api/match/candidates?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        setCandidateQueue(data.candidates || []);
      }
    } catch (err) {
      console.error("Failed to load candidates:", err);
    }
  }, [userId]);

  const createConversation = useCallback(async () => {
    if (!userId) {
      setGlobalError("No user profile found. Please complete onboarding first.");
      return;
    }

    // Pick the next best unmatched candidate
    const nextCandidate = candidateQueue.find((c) => !matchedUserIds.has(c.userId));
    if (!nextCandidate) {
      setGlobalError("No more candidates available. You've matched with everyone!");
      return;
    }

    const matchUserId = nextCandidate.userId;
    setMatchedUserIds((prev) => new Set(prev).add(matchUserId));

    setIsCreatingConversation(true);
    setGlobalError("");

    try {
      const response = await fetchBackend("/api/match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: userId, userBId: matchUserId }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(
          (errorPayload as { error?: string }).error || "Failed to start match",
        );
      }

      const payload = await response.json();
      const sessionId = payload.sessionId as string;
      const peerName = matchUserId === "demo-agent"
        ? (userSnapshot?.suggestedMatchPersona?.name ?? "Ava")
        : `Match ${conversationCounterRef.current}`;
      const label = `Match #${conversationCounterRef.current} (${nextCandidate.preScore}%)`;
      conversationCounterRef.current += 1;

      const persona = userSnapshot?.suggestedMatchPersona ?? {
        id: matchUserId,
        name: peerName,
        gender: "female" as const,
        avatarSeed: hashSeed(matchUserId),
      };

      const baseConversation: LoungeConversation = {
        sessionId,
        label,
        peerLabel: matchUserId === "demo-agent" ? persona.name : peerName,
        peerAvatarSeed: matchUserId === "demo-agent" ? persona.avatarSeed : hashSeed(matchUserId),
        state: "INIT",
        messages: [],
        score: nextCandidate.preScore,
        scoreSeries: [nextCandidate.preScore],
        breakdown: { preConversation: nextCandidate.preScore },
        elapsed: 0,
        connecting: true,
        myAgentActive: false,
        peerAgentReady: false,
        result: null,
        error: "",
        unread: 0,
        dateSuggestion: null,
        scheduleStatus: "idle",
        scheduleError: "",
      };

      setConversations((previous) => [baseConversation, ...previous]);
      setActiveConversationId(sessionId);

      const socket = io(`${backendUrl}/conversation`, {
        query: { sessionId, userAId: userId, userBId: matchUserId },
      });

      socketsRef.current[sessionId] = socket;

      socket.on("connect", () => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          connecting: false,
          error: "",
        }));
      });

      socket.on(
        "agent_status_update",
        (status: {
          userAId: string;
          userAReady: boolean;
          userBId: string;
          userBReady: boolean;
        }) => {
          updateConversation(sessionId, (conversation) => {
            const amUserA = status.userAId === userId;
            return {
              ...conversation,
              myAgentActive: amUserA ? status.userAReady : status.userBReady,
              peerAgentReady: amUserA ? status.userBReady : status.userAReady,
            };
          });
        },
      );

      socket.on("agent_message", (message: ChatMessage) => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          messages: [...conversation.messages, message],
          unread:
            activeConversationIdRef.current === sessionId
              ? conversation.unread
              : conversation.unread + 1,
        }));
      });

      socket.on(
        "compatibility_update",
        (scoreUpdate: { score: number; breakdown: ScoreBreakdown }) => {
          const score = toPercent(scoreUpdate.score);
          updateConversation(sessionId, (conversation) => ({
            ...conversation,
            score,
            scoreSeries: appendScore(conversation.scoreSeries, score),
            breakdown: {
              preConversation: toPercent(scoreUpdate.breakdown.preConversation),
              personality: toPercent(scoreUpdate.breakdown.personality),
              flow: toPercent(scoreUpdate.breakdown.flow),
              topic: toPercent(scoreUpdate.breakdown.topic),
            },
          }));
        },
      );

      socket.on("state_change", (event: { state: ConversationState }) => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          state: event.state,
        }));
      });

      socket.on("timer_tick", (event: { elapsedSeconds: number }) => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          elapsed: event.elapsedSeconds,
        }));
      });

      socket.on("conversation_end", (event: ConversationResult) => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          state: "SCORE",
          result: event,
          score: toPercent(event.compatibilityScore),
          scoreSeries:
            event.trendOverTime && event.trendOverTime.length > 0
              ? event.trendOverTime.map((point) => toPercent(point))
              : conversation.scoreSeries,
          breakdown: {
            preConversation: toPercent(event.breakdown.preConversation),
            personality: toPercent(event.breakdown.personality),
            flow: toPercent(event.breakdown.flow),
            topic: toPercent(event.breakdown.topic),
          },
          dateSuggestion:
            toPercent(event.compatibilityScore) > MATCH_THRESHOLD
              ? generateDateSuggestion(sessionId)
              : null,
        }));
      });

      socket.on("error", (event: { message: string }) => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          connecting: false,
          error: event.message,
        }));
      });

      socket.on("connect_error", () => {
        updateConversation(sessionId, (conversation) => ({
          ...conversation,
          connecting: false,
          error: "Failed to connect to conversation server",
        }));
      });
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "Unknown error while creating conversation",
      );
    } finally {
      setIsCreatingConversation(false);
    }
  }, [backendUrl, candidateQueue, matchedUserIds, updateConversation, userId, userSnapshot]);

  useEffect(() => {
    void loadUserSnapshot();
  }, [loadUserSnapshot]);

  // Load candidates after profile is ready
  useEffect(() => {
    if (!userId || isLoadingProfile) return;
    void loadCandidates();
  }, [userId, isLoadingProfile, loadCandidates]);

  useEffect(() => {
    return () => {
      Object.values(socketsRef.current).forEach((socket) => {
        socket.disconnect();
      });
      socketsRef.current = {};
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  const selectConversation = (sessionId: string) => {
    setActiveConversationId(sessionId);
    updateConversation(sessionId, (conversation) => ({
      ...conversation,
      unread: 0,
    }));
  };

  const toggleMyAgent = () => {
    if (!activeConversation) return;
    const socket = socketsRef.current[activeConversation.sessionId];
    if (!socket) return;

    const nextActiveState = !activeConversation.myAgentActive;
    updateConversation(activeConversation.sessionId, (conversation) => ({
      ...conversation,
      myAgentActive: nextActiveState,
    }));

    socket.emit("set_agent_active", { active: nextActiveState });
  };

  const scheduleDateForConversation = async (conversation: LoungeConversation) => {
    if (!userId || !conversation.dateSuggestion) return;

    updateConversation(conversation.sessionId, (entry) => ({
      ...entry,
      scheduleStatus: "saving",
      scheduleError: "",
    }));

    try {
      const response = await fetchBackend("/api/profile/upcoming-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sessionId: conversation.sessionId,
          withName: conversation.peerLabel,
          scheduledAt: conversation.dateSuggestion.scheduledAt,
          place: conversation.dateSuggestion.place,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to schedule date");
      }

      const normalizedUpcomingDates = Array.isArray(payload.upcomingDates)
        ? (payload.upcomingDates as UpcomingDate[])
        : userSnapshot?.profile.upcomingDates || [];

      setUserSnapshot((previous) =>
        previous
          ? {
              ...previous,
              profile: {
                ...previous.profile,
                upcomingDates: normalizedUpcomingDates,
              },
            }
          : previous,
      );

      updateConversation(conversation.sessionId, (entry) => ({
        ...entry,
        scheduleStatus: "saved",
        scheduleError: "",
      }));
    } catch (error) {
      updateConversation(conversation.sessionId, (entry) => ({
        ...entry,
        scheduleStatus: "idle",
        scheduleError:
          error instanceof Error ? error.message : "Failed to schedule date",
      }));
    }
  };

  const declineDateForConversation = (sessionId: string) => {
    updateConversation(sessionId, (entry) => ({
      ...entry,
      scheduleStatus: "declined",
      scheduleError: "",
    }));
  };

  const remainingSeconds = activeConversation
    ? Math.max(0, TOTAL_DURATION_SECONDS - activeConversation.elapsed)
    : TOTAL_DURATION_SECONDS;

  const progressPercent = activeConversation
    ? Math.min(100, (activeConversation.elapsed / TOTAL_DURATION_SECONDS) * 100)
    : 0;

  const breakdownRows = activeConversation
    ? [
        { label: "Pre", value: toPercent(activeConversation.breakdown.preConversation) },
        {
          label: "Personality",
          value: toPercent(activeConversation.breakdown.personality),
        },
        { label: "Flow", value: toPercent(activeConversation.breakdown.flow) },
        { label: "Topic", value: toPercent(activeConversation.breakdown.topic) },
      ]
    : [];

  const myName =
    userSnapshot?.account.displayName ||
    userSnapshot?.profile.name ||
    "You";
  const mySeed = hashSeed(myName);
  const myAvatarUrl = userSnapshot?.account.avatarUrl || userSnapshot?.profile.avatarUrl || null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 min-h-screen px-3 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-3">
          <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                Agent <span className="text-gradient-rose">Lounge</span>
              </h1>
              <p className="text-xs text-muted-foreground md:text-sm">
                Switch conversations and watch compatibility move in real time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createConversation()}
                disabled={isCreatingConversation || !userId || isLoadingProfile || candidateQueue.filter((c) => !matchedUserIds.has(c.userId)).length === 0}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingConversation
                  ? "Matching..."
                  : `New Match (${candidateQueue.filter((c) => !matchedUserIds.has(c.userId)).length} left)`}
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(`/profile${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`)
                }
                className="rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted/30"
              >
                View My Profile
              </button>
            </div>
          </div>

          {globalError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {globalError}
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[290px_minmax(0,1fr)_330px]">
            <aside className="glass-strong min-h-[250px] rounded-2xl p-3">
              <p className="px-2 pb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Conversations
              </p>

              <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-1">
                {conversations.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No conversations yet.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Click &quot;New Match&quot; to start your first conversation.
                    </p>
                  </div>
                )}
                {conversations.map((conversation) => {
                  const selected = conversation.sessionId === activeConversationId;
                  const lastMessage =
                    conversation.messages[conversation.messages.length - 1];

                  return (
                    <button
                      key={conversation.sessionId}
                      type="button"
                      onClick={() => selectConversation(conversation.sessionId)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-primary/60 bg-primary/15"
                          : "border-border/50 bg-black/20 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MiniFace
                            name={conversation.peerLabel}
                            seed={conversation.peerAvatarSeed}
                            size="sm"
                          />
                          <p className="truncate text-sm font-semibold text-foreground">
                            {conversation.label}
                          </p>
                        </div>
                        {conversation.unread > 0 && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {conversation.unread}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{stateLabel(conversation.state)}</span>
                        <span>{Math.round(conversation.score)}%</span>
                      </div>

                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {lastMessage?.content ||
                          `${conversation.peerLabel} is waiting to chat.`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="glass-strong min-h-[420px] overflow-hidden rounded-2xl flex flex-col">
              {!activeConversation ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center">
                  <div className="space-y-3">
                    <AgentAvatar mode="idle" />
                    <p className="text-sm text-muted-foreground">
                      Choose a conversation from the left.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MiniFace name={myName} seed={mySeed} avatarUrl={myAvatarUrl} size="sm" />
                      <MiniFace
                        name={activeConversation.peerLabel}
                        seed={activeConversation.peerAvatarSeed}
                        size="sm"
                      />
                      <div>
                        <p className="font-semibold text-foreground">
                          {myName} vs {activeConversation.peerLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeConversation.label} • {stateLabel(activeConversation.state)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={toggleMyAgent}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        activeConversation.myAgentActive
                          ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {activeConversation.myAgentActive
                        ? "Deactivate Agent"
                        : "Activate Agent"}
                    </button>
                  </div>

                  {activeConversation.error && (
                    <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                      {activeConversation.error}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {activeConversation.connecting ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-muted-foreground animate-pulse">
                          Connecting...
                        </p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {activeConversation.messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${
                              message.sender === "agent_a"
                                ? "justify-start"
                                : "justify-end"
                            }`}
                          >
                            <div
                              className={`max-w-[84%] rounded-2xl px-4 py-3 ${
                                message.sender === "agent_a"
                                  ? "rounded-tl-sm bg-primary/20 text-foreground"
                                  : "rounded-tr-sm bg-accent/20 text-foreground"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                                <span>
                                  {message.sender === "agent_a"
                                    ? myName
                                    : activeConversation.peerLabel}
                                </span>
                                <span>{formatMessageTime(message.timestamp)}</span>
                              </div>
                              <p className="text-sm leading-relaxed">{message.content}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {activeConversation.state === "INIT" && (
                    <div className="border-t border-border/40 bg-black/20 px-4 py-3 text-xs text-muted-foreground">
                      Waiting for both agents to activate. Peer status: {" "}
                      {activeConversation.peerAgentReady ? "Ready" : "Not ready"}
                    </div>
                  )}

                  {(activeConversation.state === "LIVE" ||
                    activeConversation.state === "WRAP") && (
                    <div className="border-t border-border/40 px-4 py-3 text-xs text-muted-foreground">
                      Agents are talking. Compatibility is updating live.
                    </div>
                  )}
                </>
              )}
            </section>

            <aside className="glass-strong min-h-[320px] rounded-2xl p-4 space-y-4">
              {activeConversation ? (
                <>
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Compatibility Trend
                    </p>
                    <p className="font-display text-4xl font-black text-gradient-rose">
                      {Math.round(activeConversation.score)}%
                    </p>
                  </div>

                  <TrendGraph
                    series={activeConversation.scoreSeries}
                    colorClass={
                      activeConversation.score > MATCH_THRESHOLD
                        ? "stroke-emerald-400"
                        : "stroke-primary"
                    }
                  />

                  <div className="space-y-2 rounded-xl border border-border/50 bg-black/20 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Time Remaining</span>
                      <span className="font-mono text-foreground">
                        {formatTime(remainingSeconds)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                      <motion.div
                        className="h-full bg-primary"
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border/50 bg-black/20 p-3">
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      Breakdown
                    </p>
                    {breakdownRows.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="text-foreground">
                            {Math.round(item.value)}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <motion.div
                            className="h-full bg-primary/80"
                            animate={{ width: `${item.value}%` }}
                            transition={{ duration: 0.25 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {activeConversation.state === "SCORE" &&
                    activeConversation.result && (
                      <div
                        className={`rounded-xl border px-3 py-3 text-sm ${
                          activeConversation.result.compatibilityScore >
                          MATCH_THRESHOLD
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-400/40 bg-amber-500/10 text-amber-100"
                        }`}
                      >
                        {activeConversation.result.compatibilityScore >
                        MATCH_THRESHOLD
                          ? `Match found with ${activeConversation.peerLabel}.`
                          : "No match for this session. Conversation ended without crossing the threshold."}
                      </div>
                    )}

                  {activeConversation.state === "SCORE" &&
                    activeConversation.result &&
                    activeConversation.result.compatibilityScore >
                      MATCH_THRESHOLD &&
                    activeConversation.dateSuggestion && (
                      <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-3">
                        <p className="text-sm font-semibold text-foreground">
                          Schedule this date?
                        </p>
                        <div className="text-xs text-muted-foreground">
                          <p>
                            <span className="text-foreground">With:</span>{" "}
                            {activeConversation.peerLabel}
                          </p>
                          <p>
                            <span className="text-foreground">When:</span>{" "}
                            {formatDateTime(
                              activeConversation.dateSuggestion.scheduledAt,
                            )}
                          </p>
                          <p>
                            <span className="text-foreground">Where:</span>{" "}
                            {activeConversation.dateSuggestion.place}
                          </p>
                        </div>

                        {activeConversation.scheduleStatus === "saved" ? (
                          <div className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">
                            Date added to your upcoming dates.
                          </div>
                        ) : activeConversation.scheduleStatus === "declined" ? (
                          <div className="rounded-md border border-border/50 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
                            Skipped for now. You can schedule later from your profile.
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={
                                activeConversation.scheduleStatus === "saving"
                              }
                              onClick={() =>
                                void scheduleDateForConversation(activeConversation)
                              }
                              className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                            >
                              {activeConversation.scheduleStatus === "saving"
                                ? "Saving..."
                                : "Yes, schedule it"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                declineDateForConversation(
                                  activeConversation.sessionId,
                                )
                              }
                              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground transition hover:bg-muted/30"
                            >
                              Not now
                            </button>
                          </div>
                        )}

                        {activeConversation.scheduleError && (
                          <p className="text-xs text-destructive">
                            {activeConversation.scheduleError}
                          </p>
                        )}
                      </div>
                    )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a conversation to view metrics.
                </p>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLounge;
