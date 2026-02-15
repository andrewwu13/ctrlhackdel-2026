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

type LoungeConversation = {
  sessionId: string;
  label: string;
  peerLabel: string;
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
};

const TOTAL_DURATION_SECONDS = 180;
const MAX_SERIES_POINTS = 90;

const toPercent = (value?: number): number => {
  if (value == null || Number.isNaN(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
};

const formatTime = (seconds: number) => {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  const [conversations, setConversations] = useState<LoungeConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const backendUrl = useMemo(() => getBackendUrl(), []);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.sessionId === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const updateConversation = useCallback(
    (sessionId: string, updater: (conversation: LoungeConversation) => LoungeConversation) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.sessionId === sessionId ? updater(conversation) : conversation,
        ),
      );
    },
    [],
  );

  const createConversation = useCallback(async () => {
    if (!userId) {
      setGlobalError("No user profile found. Please complete onboarding first.");
      return;
    }

    setIsCreatingConversation(true);
    setGlobalError("");

    try {
      const response = await fetchBackend("/api/match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: userId, userBId: "demo-agent" }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error((errorPayload as { error?: string }).error || "Failed to start match");
      }

      const payload = await response.json();
      const sessionId = payload.sessionId as string;
      const label = `Conversation ${conversationCounterRef.current}`;
      conversationCounterRef.current += 1;

      const baseConversation: LoungeConversation = {
        sessionId,
        label,
        peerLabel: "demo-agent",
        state: "INIT",
        messages: [],
        score: 0,
        scoreSeries: [],
        breakdown: {},
        elapsed: 0,
        connecting: true,
        myAgentActive: false,
        peerAgentReady: false,
        result: null,
        error: "",
        unread: 0,
      };

      setConversations((previous) => [baseConversation, ...previous]);
      setActiveConversationId(sessionId);

      const socket = io(`${backendUrl}/conversation`, {
        query: { sessionId, userAId: userId, userBId: "demo-agent" },
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
      setGlobalError(error instanceof Error ? error.message : "Unknown error while creating conversation");
    } finally {
      setIsCreatingConversation(false);
    }
  }, [backendUrl, updateConversation, userId]);

  useEffect(() => {
    if (!userId) {
      setGlobalError("No user profile found. Please complete onboarding first.");
      return;
    }

    if (conversations.length === 0 && !isCreatingConversation) {
      void createConversation();
    }
  }, [conversations.length, createConversation, isCreatingConversation, userId]);

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

  const remainingSeconds = activeConversation
    ? Math.max(0, TOTAL_DURATION_SECONDS - activeConversation.elapsed)
    : TOTAL_DURATION_SECONDS;

  const progressPercent = activeConversation
    ? Math.min(100, (activeConversation.elapsed / TOTAL_DURATION_SECONDS) * 100)
    : 0;

  const breakdownRows = activeConversation
    ? [
        { label: "Pre", value: toPercent(activeConversation.breakdown.preConversation) },
        { label: "Personality", value: toPercent(activeConversation.breakdown.personality) },
        { label: "Flow", value: toPercent(activeConversation.breakdown.flow) },
        { label: "Topic", value: toPercent(activeConversation.breakdown.topic) },
      ]
    : [];

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
                Switch between conversations and monitor compatibility in real time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createConversation()}
                disabled={isCreatingConversation || !userId}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingConversation ? "Starting..." : "New Conversation"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/onboarding")}
                className="rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted/30"
              >
                Edit Profile
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
                {conversations.map((conversation) => {
                  const selected = conversation.sessionId === activeConversationId;
                  const lastMessage = conversation.messages[conversation.messages.length - 1];

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
                        <p className="truncate text-sm font-semibold text-foreground">
                          {conversation.label}
                        </p>
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
                        {lastMessage?.content || "No messages yet. Activate to begin."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="glass-strong min-h-[420px] rounded-2xl overflow-hidden flex flex-col">
              {!activeConversation ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center">
                  <div className="space-y-3">
                    <AgentAvatar mode="idle" />
                    <p className="text-sm text-muted-foreground">Choose a conversation from the left.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                    <div>
                      <p className="font-semibold text-foreground">{activeConversation.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Chatting with {activeConversation.peerLabel} • {stateLabel(activeConversation.state)}
                      </p>
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
                      {activeConversation.myAgentActive ? "Deactivate Agent" : "Activate Agent"}
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
                        <p className="text-sm text-muted-foreground animate-pulse">Connecting...</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {activeConversation.messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${message.sender === "agent_a" ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[84%] rounded-2xl px-4 py-3 ${
                                message.sender === "agent_a"
                                  ? "rounded-tl-sm bg-primary/20 text-foreground"
                                  : "rounded-tr-sm bg-accent/20 text-foreground"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                                <span>{message.sender === "agent_a" ? "Your Agent" : "Their Agent"}</span>
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
                      Waiting for both agents to be active. Peer status: {activeConversation.peerAgentReady ? "Ready" : "Not ready"}
                    </div>
                  )}

                  {(activeConversation.state === "LIVE" || activeConversation.state === "WRAP") && (
                    <div className="border-t border-border/40 px-4 py-3 text-xs text-muted-foreground">
                      Agents are talking. Compatibility is recalculating live.
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
                      activeConversation.result?.recommendMatch
                        ? "stroke-emerald-400"
                        : "stroke-primary"
                    }
                  />

                  <div className="space-y-2 rounded-xl border border-border/50 bg-black/20 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Time Remaining</span>
                      <span className="font-mono text-foreground">{formatTime(remainingSeconds)}</span>
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
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Breakdown</p>
                    {breakdownRows.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="text-foreground">{Math.round(item.value)}%</span>
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

                  {activeConversation.state === "SCORE" && activeConversation.result && (
                    <div
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        activeConversation.result.recommendMatch
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-400/40 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      {activeConversation.result.recommendMatch
                        ? "Match detected. This conversation crossed the current threshold."
                        : "No match for this session. The conversation closed at the timer cutoff."}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a conversation to view metrics.</p>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLounge;
