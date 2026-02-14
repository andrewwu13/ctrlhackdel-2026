"use client";

import type { ScoreBreakdown } from "@/lib/types";
import styles from "./RadarChart.module.css";

interface RadarChartProps {
  breakdown: ScoreBreakdown;
  size?: number;
}

const LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "preConversation", label: "Profile Match" },
  { key: "personality", label: "Personality" },
  { key: "flow", label: "Chemistry" },
  { key: "topic", label: "Interests" },
];

export default function RadarChart({ breakdown, size = 240 }: RadarChartProps) {
  const center = size / 2;
  const maxRadius = size / 2 - 30;
  const angleStep = (2 * Math.PI) / LABELS.length;

  // Generate points for the data polygon
  const points = LABELS.map((item, i) => {
    const angle = i * angleStep - Math.PI / 2; // Start from top
    const value = (breakdown[item.key] ?? 0) / 100;
    const r = value * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      labelX: center + (maxRadius + 20) * Math.cos(angle),
      labelY: center + (maxRadius + 20) * Math.sin(angle),
      label: item.label,
      value: breakdown[item.key] ?? 0,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid rings (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className={styles.container}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={LABELS.map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = ring * maxRadius;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(" ")}
            fill="none"
            stroke="var(--border, #333)"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}

        {/* Axis lines */}
        {LABELS.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + maxRadius * Math.cos(angle)}
              y2={center + maxRadius * Math.sin(angle)}
              stroke="var(--border, #333)"
              strokeWidth="1"
              opacity="0.3"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(124, 58, 237, 0.25)"
          stroke="#7c3aed"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#7c3aed" />
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-muted, #aaa)"
            fontSize="11"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
