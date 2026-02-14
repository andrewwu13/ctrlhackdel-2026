"use client";

import { useEffect, useState } from "react";
import styles from "./CountdownRing.module.css";

interface CountdownRingProps {
  totalSeconds: number;
  elapsedSeconds: number;
  size?: number;
  strokeWidth?: number;
}

export default function CountdownRing({
  totalSeconds,
  elapsedSeconds,
  size = 120,
  strokeWidth = 8,
}: CountdownRingProps) {
  const [progress, setProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const remaining = Math.max(0, totalSeconds - elapsedSeconds);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  useEffect(() => {
    setProgress(elapsedSeconds / totalSeconds);
  }, [elapsedSeconds, totalSeconds]);

  const strokeDashoffset = circumference - progress * circumference;

  // Color shifts as time runs out
  const getColor = () => {
    if (remaining <= 10) return "#e94560";
    if (remaining <= 30) return "#f59e0b";
    return "#7c3aed";
  };

  return (
    <div className={styles.container}>
      <svg width={size} height={size} className={styles.ring}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-alt, #16213e)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={styles.progressRing}
        />
      </svg>
      <div className={styles.time}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
    </div>
  );
}
