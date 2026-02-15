import { motion } from "framer-motion";

type AgentMode = "booting" | "speaking" | "listening" | "thinking" | "generating" | "idle";

type AgentAvatarProps = {
  mode: AgentMode;
};

const ringOpacity = (mode: AgentMode) => {
  if (mode === "speaking") return 0.7;
  if (mode === "listening") return 0.55;
  if (mode === "thinking") return 0.4;
  if (mode === "generating") return 0.65;
  return 0.25;
};

const AgentAvatar = ({ mode }: AgentAvatarProps) => {
  const speaking = mode === "speaking";
  const listening = mode === "listening";

  return (
    <div className="relative w-72 h-72 md:w-[26rem] md:h-[26rem]">
      <img
        src="/agent-halo.svg"
        alt="Agent halo"
        className="absolute inset-0 w-full h-full object-contain opacity-70"
      />

      <motion.div
        className="absolute inset-[20%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, hsla(350,78%,66%,0.95), hsla(280,70%,40%,0.78) 45%, hsla(240,58%,20%,0.9) 100%)",
          filter: "blur(0.5px)",
        }}
        animate={{
          scale: speaking ? [1, 1.08, 1] : listening ? [1, 1.03, 1] : [1, 1.02, 1],
          rotate: mode === "thinking" ? [0, 6, -6, 0] : 0,
        }}
        transition={{ duration: speaking ? 1.25 : 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute inset-[15%] rounded-full"
        style={{
          border: "1px solid hsla(46,100%,50%,0.35)",
          boxShadow: "0 0 80px hsla(350,78%,56%,0.35)",
        }}
        animate={{
          scale: speaking ? [1, 1.16, 1] : listening ? [1, 1.1, 1] : [1, 1.05, 1],
          opacity: [ringOpacity(mode), 0.15, ringOpacity(mode)],
        }}
        transition={{ duration: speaking ? 1.1 : 2.2, repeat: Infinity, ease: "easeOut" }}
      />

      <motion.div
        className="absolute inset-[8%] rounded-full"
        style={{ border: "1px solid hsla(330,20%,95%,0.24)" }}
        animate={{
          scale: speaking ? [1, 1.22, 1] : [1, 1.12, 1],
          opacity: [0.35, 0.08, 0.35],
        }}
        transition={{ duration: speaking ? 1.5 : 2.8, repeat: Infinity, ease: "easeOut" }}
      />

      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 44;
        const y = Math.sin(angle) * 44;

        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full"
            style={{
              marginLeft: -6,
              marginTop: -6,
              background: i % 2 ? "hsla(46,100%,50%,0.8)" : "hsla(350,78%,66%,0.82)",
            }}
            animate={{
              x: listening ? [x, x * 1.25, x] : [x, x * 1.08, x],
              y: listening ? [y, y * 1.25, y] : [y, y * 1.08, y],
              opacity: [0.35, 0.95, 0.35],
              scale: speaking ? [1, 1.5, 1] : [1, 1.2, 1],
            }}
            transition={{
              duration: listening ? 1.25 : 2.2,
              delay: i * 0.08,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}

      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-end gap-1.5 h-8">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full bg-primary/80"
            animate={{
              height: speaking
                ? [8, 24 - Math.abs(3 - i) * 2, 8]
                : listening
                ? [6, 14, 6]
                : [4, 7, 4],
              opacity: speaking || listening ? [0.4, 1, 0.4] : 0.35,
            }}
            transition={{
              duration: speaking ? 0.45 : listening ? 0.9 : 1.8,
              repeat: Infinity,
              delay: i * 0.06,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AgentAvatar;
