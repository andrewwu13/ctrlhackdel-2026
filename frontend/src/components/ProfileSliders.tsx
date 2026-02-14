"use client";

import { useState } from "react";
import styles from "./ProfileSliders.module.css";

interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

interface ProfileSlidersProps {
  sliders?: SliderConfig[];
  onChange?: (values: Record<string, number>) => void;
}

const DEFAULT_SLIDERS: SliderConfig[] = [
  { key: "openness", label: "Openness", min: 0, max: 100, step: 1, defaultValue: 50 },
  { key: "conscientiousness", label: "Conscientiousness", min: 0, max: 100, step: 1, defaultValue: 50 },
  { key: "extraversion", label: "Extraversion", min: 0, max: 100, step: 1, defaultValue: 50 },
  { key: "agreeableness", label: "Agreeableness", min: 0, max: 100, step: 1, defaultValue: 50 },
  { key: "neuroticism", label: "Neuroticism", min: 0, max: 100, step: 1, defaultValue: 50 },
];

export default function ProfileSliders({
  sliders = DEFAULT_SLIDERS,
  onChange,
}: ProfileSlidersProps) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(sliders.map((s) => [s.key, s.defaultValue]))
  );

  const handleChange = (key: string, value: number) => {
    const updated = { ...values, [key]: value };
    setValues(updated);
    onChange?.(updated);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Profile Vector</h3>
      {sliders.map((slider) => (
        <div key={slider.key} className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>{slider.label}</label>
            <span className={styles.value}>{values[slider.key]}</span>
          </div>
          <input
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={values[slider.key]}
            onChange={(e) => handleChange(slider.key, Number(e.target.value))}
            className={styles.slider}
          />
        </div>
      ))}
    </div>
  );
}
