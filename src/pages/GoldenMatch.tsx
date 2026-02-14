import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import LegoRose from "@/components/LegoRose";
import { Heart, X, Sparkles } from "lucide-react";

const GoldenMatch = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0); // 0=bg shift, 1=rose drop, 2=profile reveal, 3=invitation

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2200),
      setTimeout(() => setPhase(3), 3800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Dramatic background shift */}
      <motion.div
        className="fixed inset-0 -z-10"
        animate={{
          background: phase >= 1
            ? "radial-gradient(ellipse at 50% 50%, hsla(350, 78%, 30%, 1) 0%, hsla(270, 50%, 8%, 1) 70%)"
            : "radial-gradient(ellipse at 50% 50%, hsla(270, 50%, 12%, 1) 0%, hsla(270, 50%, 8%, 1) 70%)",
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      {/* Particles */}
      <AnimatePresence>
        {phase >= 2 && [...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              background: i % 3 === 0 ? "hsl(46, 100%, 50%)" : "hsl(350, 78%, 56%)",
              left: `${Math.random() * 100}%`,
            }}
            initial={{ y: -20, opacity: 0 }}
            animate={{
              y: [Math.random() * -100, window.innerHeight + 100],
              opacity: [0, 1, 0],
              x: [0, (Math.random() - 0.5) * 200],
            }}
            transition={{
              duration: 3 + Math.random() * 3,
              delay: Math.random() * 2,
              repeat: Infinity,
            }}
          />
        ))}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center gap-6 px-4">
        {/* Rose descent */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ y: -300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 80, damping: 12, mass: 1.5 }}
            >
              <LegoRose size={180} blooming={phase >= 2} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile reveal — blur melt */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              className="relative w-32 h-32 rounded-2xl overflow-hidden glass"
              initial={{ filter: "blur(80px)", opacity: 0, scale: 0.8 }}
              animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
              transition={{ duration: 2, ease: "easeOut" }}
            >
              <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-accent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Match text */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              className="text-center space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <h2 className="font-display text-4xl font-black text-gradient-gold">
                Golden Match
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                "I found a match. You both prioritize innovation and have a shared interest in autonomous systems."
              </p>
              <p className="text-accent font-mono text-lg font-bold">94.2% Compatible</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invitation card */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-sm w-full space-y-4"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
            >
              <h3 className="font-display text-lg font-semibold text-foreground text-center">
                Would you like to connect?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => navigate("/vault")}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer glow-rose"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart className="w-4 h-4" /> Accept
                </motion.button>
                <motion.button
                  onClick={() => navigate("/lounge")}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl glass text-muted-foreground font-semibold cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-4 h-4" /> Decline
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GoldenMatch;
