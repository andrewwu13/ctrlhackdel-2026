"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import type { ScoreBreakdown, CompatibilityResult } from "@/lib/types";

interface UseCompatibilityOptions {
  socket: Socket | null;
}

interface UseCompatibilityReturn {
  score: number;
  breakdown: ScoreBreakdown | null;
  trend: number[];
  finalResult: CompatibilityResult | null;
  isComplete: boolean;
}

/**
 * Hook that subscribes to live compatibility score updates from the conversation socket.
 */
export function useCompatibility({
  socket,
}: UseCompatibilityOptions): UseCompatibilityReturn {
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [trend, setTrend] = useState<number[]>([]);
  const [finalResult, setFinalResult] = useState<CompatibilityResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const trendRef = useRef<number[]>([]);

  const handleCompatibilityUpdate = useCallback(
    (data: { score: number; breakdown: ScoreBreakdown }) => {
      setScore(data.score);
      setBreakdown(data.breakdown);
      trendRef.current = [...trendRef.current, data.score];
      setTrend([...trendRef.current]);
    },
    []
  );

  const handleConversationEnd = useCallback((result: CompatibilityResult) => {
    setFinalResult(result);
    setIsComplete(true);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("compatibility_update", handleCompatibilityUpdate);
    socket.on("conversation_end", handleConversationEnd);

    return () => {
      socket.off("compatibility_update", handleCompatibilityUpdate);
      socket.off("conversation_end", handleConversationEnd);
    };
  }, [socket, handleCompatibilityUpdate, handleConversationEnd]);

  return { score, breakdown, trend, finalResult, isComplete };
}
