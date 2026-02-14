import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import LegoRose from "@/components/LegoRose";
import { Bug, Zap, Eye } from "lucide-react";

const THOUGHT_CHAINS = [
  "Initializing Soul-Agent for User::Anhad...",
  "Scanning USER_VECTORS table... 1,247 active profiles loaded.",
  "Agent Anhad → Agent Sarah: Checking career alignment... 72% match.",
  "Agent Anhad → Agent Priya: Validating humor compatibility... [ANALYZING]",
  "Reasoning: Both users mentioned 'First-year CS at McMaster.'",
  "Checking overlap in academic stress levels... Alignment Found.",
  "Agent Anhad → Agent Priya: Humor sync at 88%. Proceeding...",
  "Agent Anhad → Agent Maya: Hard-No value detected — 'Long-distance'. Severing.",
  "Agent Anhad → Agent Priya: Checking emotional depth vectors...",
  "Cross-referencing Snowflake SYNTHETIC_SOULS index...",
  "Agent Anhad → Agent Priya: Shared interest in autonomous systems detected.",
  "Running Inverted Vetting: Attempting 3 rejection reasons...",
  "Rejection attempt 1: Career mismatch? → No. Both in tech/engineering.",
  "Rejection attempt 2: Lifestyle conflict? → No. Both urban, active.",
  "Rejection attempt 3: Value divergence? → No. Innovation + Empathy aligned.",
  "⚡ FAILED TO REJECT after 5 exchanges. Flagging as HIGH-VALUE candidate.",
  "Compatibility Score: 94.2% — GOLDEN MATCH THRESHOLD EXCEEDED.",
];

const MISSIONS = [
  { name: "Agent Sarah", status: "Severed", score: 72, reason: "Career misalignment" },
  { name: "Agent Maya", status: "Severed", score: 45, reason: "Hard-No: Long-distance" },
  { name: "Agent Priya", status: "Active", score: 94, reason: "High-Value candidate" },
  { name: "Agent Noor", status: "Pending", score: 0, reason: "In queue..." },
];

const AgentLounge = () => {
  const navigate = useNavigate();
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [debugMode, setDebugMode] = useState(false);
  const [matchReady, setMatchReady] = useState(false);
  const [roseBloom, setRoseBloom] = useState(0.3);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < THOUGHT_CHAINS.length) {
        setThoughts((prev) => [...prev, THOUGHT_CHAINS[idx]]);
        setRoseBloom(Math.min(1, 0.3 + (idx / THOUGHT_CHAINS.length) * 0.7));
        idx++;
      } else {
        clearInterval(interval);
        setMatchReady(true);
      }
    }, debugMode ? 400 : 1800);

    return () => clearInterval(interval);
  }, [debugMode]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [thoughts]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <motion.h1
            className="font-display text-3xl font-bold text-foreground"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Agent <span className="text-gradient-rose">Lounge</span>
          </motion.h1>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setDebugMode(!debugMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                debugMode ? "bg-accent text-accent-foreground glow-gold" : "glass text-muted-foreground"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bug className="w-4 h-4" />
              Debug Mode
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Active Missions */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> Active Missions
            </h2>
            {MISSIONS.map((mission, i) => (
              <motion.div
                key={mission.name}
                className="glass rounded-xl p-4 group cursor-pointer relative overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground text-sm">{mission.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    mission.status === "Active" ? "bg-primary/20 text-primary" :
                    mission.status === "Severed" ? "bg-destructive/20 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {mission.status}
                  </span>
                </div>
                {mission.score > 0 && (
                  <div className="w-full h-1.5 rounded-full bg-muted mb-2">
                    <motion.div
                      className={`h-full rounded-full ${mission.score > 90 ? "bg-accent" : "bg-primary/60"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${mission.score}%` }}
                      transition={{ delay: 0.5 + i * 0.2, duration: 1 }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{mission.reason}</p>

                {/* Ghost View on hover */}
                <div className="absolute inset-0 glass-strong opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
                  <p className="text-xs font-mono text-primary/80">
                    <Eye className="w-3 h-3 inline mr-1" />
                    cosine_sim({mission.name.split(" ")[1].toLowerCase()}_vec, user_vec) = {(mission.score / 100).toFixed(3)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Center: Rose + Match button */}
          <div className="flex flex-col items-center justify-center gap-6">
            <LegoRose size={200} blooming={roseBloom > 0.5} />
            <p className="text-sm text-muted-foreground font-mono">
              Bloom: {(roseBloom * 100).toFixed(0)}%
            </p>

            <AnimatePresence>
              {matchReady && (
                <motion.button
                  onClick={() => navigate("/match")}
                  className="px-8 py-4 rounded-2xl font-display font-bold text-lg bg-accent text-accent-foreground glow-gold cursor-pointer"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  ✨ Golden Match Found
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Thought Chain Terminal */}
          <div className="glass rounded-xl p-4 flex flex-col">
            <h2 className="font-display text-lg font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Thought Chain
            </h2>
            <div
              ref={terminalRef}
              className="flex-1 max-h-[400px] overflow-y-auto space-y-1.5 font-mono text-xs pr-2"
            >
              {thoughts.map((t, i) => (
                <motion.p
                  key={i}
                  className={`leading-relaxed ${
                    t.includes("GOLDEN MATCH") || t.includes("HIGH-VALUE")
                      ? "text-accent font-bold"
                      : t.includes("FAILED") || t.includes("Severing")
                      ? "text-destructive/80"
                      : "text-muted-foreground/80"
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span className="text-primary/50">{">"} </span>{t}
                </motion.p>
              ))}
              {!matchReady && (
                <span className="inline-block w-2 h-4 bg-primary/60" style={{ animation: "typewriter-cursor 0.8s infinite" }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLounge;
