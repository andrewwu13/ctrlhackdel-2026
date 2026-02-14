"use client";

import styles from "./CompatibilityMeter.module.css";

interface CompatibilityMeterProps {
  score: number; // 0-100
  label?: string;
}

export default function CompatibilityMeter({
  score,
  label = "Compatibility",
}: CompatibilityMeterProps) {
  // Map score to a color gradient (red → yellow → green)
  const getColor = (s: number) => {
    if (s < 40) return "#e94560";
    if (s < 65) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className={styles.container}>
      <div className={styles.label}>{label}</div>
      <div className={styles.meterTrack}>
        <div
          className={styles.meterFill}
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, #e94560, ${getColor(score)})`,
          }}
        />
      </div>
      <div className={styles.score}>
        💘 {score}%
      </div>
    </div>
  );
}
