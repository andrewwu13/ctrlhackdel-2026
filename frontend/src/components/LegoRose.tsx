import { motion } from "framer-motion";

const petalPaths = [
  "M50 10 C60 30, 80 40, 50 70 C20 40, 40 30, 50 10",
  "M50 10 C70 20, 90 50, 50 70 C10 50, 30 20, 50 10",
  "M50 15 C65 25, 85 45, 50 65 C15 45, 35 25, 50 15",
  "M50 20 C60 30, 75 45, 50 60 C25 45, 40 30, 50 20",
  "M50 25 C58 32, 68 42, 50 55 C32 42, 42 32, 50 25",
];

const petalColors = [
  "hsla(350, 78%, 56%, 0.7)",
  "hsla(350, 78%, 50%, 0.6)",
  "hsla(350, 78%, 60%, 0.65)",
  "hsla(350, 78%, 45%, 0.55)",
  "hsla(350, 78%, 65%, 0.8)",
];

interface LegoRoseProps {
  size?: number;
  className?: string;
  blooming?: boolean;
}

const LegoRose = ({ size = 200, className = "", blooming = true }: LegoRoseProps) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 80"
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      {/* Glow filter */}
      <defs>
        <filter id="rose-glow">
          <feGaussianBlur stdDeviation="2" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="stem-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsla(140, 40%, 35%, 0.8)" />
          <stop offset="100%" stopColor="hsla(140, 40%, 25%, 0.6)" />
        </linearGradient>
      </defs>

      {/* Stem — LEGO-style rectangular */}
      <motion.rect
        x="47" y="58" width="6" height="20" rx="1"
        fill="url(#stem-grad)"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        style={{ transformOrigin: "50px 78px" }}
      />

      {/* Petals — geometric LEGO style */}
      {petalPaths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill={petalColors[i]}
          filter="url(#rose-glow)"
          initial={{ scale: 0, rotate: i * 72, opacity: 0 }}
          animate={{
            scale: blooming ? 1 : 0.3,
            rotate: blooming ? i * 72 : i * 72 + 30,
            opacity: 1,
          }}
          transition={{
            delay: 0.5 + i * 0.15,
            duration: 0.8,
            type: "spring",
            stiffness: 120,
          }}
          style={{ transformOrigin: "50px 40px" }}
        />
      ))}

      {/* Center stud — LEGO brick detail */}
      <motion.circle
        cx="50" cy="40" r="6"
        fill="hsla(46, 100%, 50%, 0.9)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
      />
      <motion.circle
        cx="50" cy="40" r="3"
        fill="hsla(46, 100%, 65%, 1)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
      />
    </motion.svg>
  );
};

export default LegoRose;
