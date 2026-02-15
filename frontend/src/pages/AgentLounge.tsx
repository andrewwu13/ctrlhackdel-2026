import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import AgentAvatar from "@/components/AgentAvatar";
import { BACKEND_URL } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────


const AgentLounge = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const userId =
    searchParams?.get("userId") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("soulbound_userId")
      : null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown>({});
  const [elapsed, setElapsed] = useState(0);
  const [state, setState] = useState<ConversationState>("INIT");
  const [result, setResult] = useState<ConversationResult | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);

  // Manual Activation State
  const [myAgentActive, setMyAgentActive] = useState(false);
  const [peerAgentReady, setPeerAgentReady] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Start match + connect socket ─────────────────────────────
  const startMatch = useCallback(async () => {
    if (!userId) {
      setError("No user profile found. Please complete onboarding first.");
      setConnecting(false);
      return;
    }

    try {
      // Start a match session via REST
      const res = await fetch(`${BACKEND_URL}/api/match/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: userId, userBId: "demo-agent" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error || "Failed to start match"
        );
      }

      const data = await res.json();
      const sessionId = data.sessionId as string;

      // Connect to Socket.IO conversation namespace
      const socket = io(`${BACKEND_URL}/conversation`, {
        query: { sessionId, userAId: userId, userBId: "demo-agent" },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setConnecting(false);
        // Do NOT emit "start" automatically anymore
      });

      socket.on("agent_status_update", (data: any) => {
        // userA is me, userB is peer (simplified for this demo flow)
        if (data.userAId === userId) {
          setMyAgentActive(data.userAReady);
        }
        // If I am userA, then userB is peer.
        // Logic might need to be robust if roles swap, but for now:
        if (data.userAId === userId) {
          setPeerAgentReady(data.userBReady);
        } else {
          // If I happened to be userB (unlikely in this flow but possible)
          setMyAgentActive(data.userBReady);
          setPeerAgentReady(data.userAReady);
        }
      });

      socket.on("agent_message", (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.on(
        "compatibility_update",
        (data: { score: number; breakdown: ScoreBreakdown }) => {
          setScore(data.score);
          setBreakdown(data.breakdown);
        }
      );

      socket.on("state_change", (data: { state: ConversationState }) => {
        setState(data.state);
      });

      socket.on("timer_tick", (data: { elapsedSeconds: number }) => {
        setElapsed(data.elapsedSeconds);
      });

      socket.on("conversation_end", (data: ConversationResult) => {
        setResult(data);
        setState("SCORE");
      });

      socket.on("error", (data: { message: string }) => {
        setError(data.message);
      });

      socket.on("connect_error", () => {
        setError("Failed to connect to conversation server");
        setConnecting(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setConnecting(false);
    }
  }, [userId]);

  useEffect(() => {
    void startMatch();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [startMatch]);

  const toggleActive = () => {
    if (!socketRef.current) return;
    const newState = !myAgentActive;
    setMyAgentActive(newState); // Optimistic update
    socketRef.current.emit("set_agent_active", { active: newState });
  };

  // ── Helpers ──────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const stateLabel =
    state === "INIT"
      ? "Initializing…"
      : state === "LIVE"
        ? "Live Conversation"
        : state === "WRAP"
          ? "Wrapping Up…"
          : "Complete";

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 min-h-screen px-4 py-6 flex flex-col max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Agent <span className="text-gradient-rose">Lounge</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono tracking-wider text-accent uppercase">
              {stateLabel}
            </span>
            {state !== "SCORE" && (
              <span className="font-mono text-sm text-muted-foreground">
                {formatTime(elapsed)} / 3:00
              </span>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="glass-strong rounded-xl p-4 mb-4 border border-destructive/30">
            <p className="text-destructive text-sm">{error}</p>
            <button
              onClick={() => router.push("/onboarding")}
              className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
            >
              Go to Onboarding
            </button>
          </div>
        )}

        {/* Loading state */}
        {connecting && !error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <AgentAvatar mode="booting" />
              <p className="text-muted-foreground animate-pulse">
                Connecting to conversation…
              </p>
            </div>
          </div>
        )}

        {/* Main content */}
        {!connecting && !error && (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Chat panel */}
            <div className="flex-1 flex flex-col glass-strong rounded-2xl overflow-hidden relative">
              {/* Manual Activation Overlay (if in INIT and not yet running) */}
              {state === "INIT" && (
                <div className="absolute inset-0 z-20 backdrop-blur-sm bg-background/40 flex flex-col items-center justify-center p-6 text-center">
                  <AgentAvatar mode={myAgentActive ? "thinking" : "idle"} />
                  <h3 className="mt-4 text-xl font-display font-bold">
                    {myAgentActive ? "Waiting for Peer..." : "Ready to Start?"}
                  </h3>
                  <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                    {myAgentActive
                      ? "Your agent is active. Waiting for the other person to connect."
                      : "Activate your agent to begin the conversation."}
                  </p>

                  <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                      onClick={toggleActive}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                        myAgentActive
                          ? "bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30"
                          : "bg-primary text-primary-foreground hover:scale-105 shadow-glow"
                      }`}
                    >
                      {myAgentActive ? "Deactivate Agent" : "Activate Agent"}
                    </button>

                    <div className="flex items-center justify-between text-xs px-2 mt-2 font-mono text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            myAgentActive ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        You
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            peerAgentReady ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        Peer
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${
                        msg.sender === "agent_a" ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          msg.sender === "agent_a"
                            ? "bg-primary/20 text-foreground rounded-tl-sm"
                            : "bg-accent/20 text-foreground rounded-tr-sm"
                        }`}
                      >
                        <p className="text-xs font-mono text-muted-foreground mb-1">
                          {msg.sender === "agent_a"
                            ? "Your Agent"
                            : "Their Agent"}
                        </p>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>

              {/* Typing indicator */}
              {state === "LIVE" || state === "WRAP" ? (
                <div className="px-4 py-2 border-t border-border/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-primary/60"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                    Agents are conversing…
                  </div>
                </div>
              ) : null}
            </div>

            {/* Score sidebar */}
            <div className="w-56 shrink-0 space-y-4 hidden md:block">
              {/* Score gauge */}
              <div className="glass-strong rounded-2xl p-4 text-center space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Compatibility
                </p>
                <p className="font-display text-4xl font-bold text-gradient-rose">
                  {Math.round(score * 100)}%
                </p>
              </div>

              {/* Breakdown */}
              <div className="glass-strong rounded-2xl p-4 space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Breakdown
                </p>
                {Object.entries(breakdown).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs text-foreground">
                      <span className="capitalize">{key}</span>
                      <span>{Math.round((value ?? 0) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/70"
                        animate={{ width: `${(value ?? 0) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Timer */}
              <div className="glass-strong rounded-2xl p-4 text-center">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Elapsed
                </p>
                <p className="font-mono text-2xl text-foreground">
                  {formatTime(elapsed)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results overlay */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 mt-4 text-center space-y-4"
          >
            <h2 className="font-display text-3xl font-bold text-foreground">
              {result.recommendMatch ? "💕" : "🤝"} Match{" "}
              {result.recommendMatch ? "Recommended!" : "Complete"}
            </h2>
            <p className="font-display text-5xl font-black text-gradient-rose">
              {Math.round(result.compatibilityScore * 100)}%
            </p>
            <p className="text-muted-foreground max-w-md mx-auto">
              {result.recommendMatch
                ? "Your agents found strong compatibility. We recommend connecting!"
                : "Your agents completed the conversation. Review the compatibility details above."}
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-display font-semibold"
            >
              Back to Home
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AgentLounge;
