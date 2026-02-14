"use client";

import { useState, useEffect } from "react";
import Chat from "@/components/Chat";
import CompatibilityMeter from "@/components/CompatibilityMeter";
import CountdownRing from "@/components/CountdownRing";
import { useSocket } from "@/hooks/useSocket";
import { useCompatibility } from "@/hooks/useCompatibility";
import type { Message, ConversationState } from "@/lib/types";
import styles from "./page.module.css";

const TOTAL_SECONDS = 180;

export default function ConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [state, setState] = useState<ConversationState>("INIT");

  // TODO: Get sessionId from URL params or state
  const sessionId = "demo-session";

  const { socket } = useSocket({
    namespace: "/conversation",
    query: { sessionId },
  });

  const { score, breakdown, isComplete } = useCompatibility({ socket });

  // Listen for conversation events
  useEffect(() => {
    if (!socket) return;

    socket.on("agent_message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("state_change", (data: { state: ConversationState }) => {
      setState(data.state);
    });

    socket.on("timer_tick", (data: { elapsedSeconds: number }) => {
      setElapsedSeconds(data.elapsedSeconds);
    });

    // Signal ready
    socket.emit("start");

    return () => {
      socket.off("agent_message");
      socket.off("state_change");
      socket.off("timer_tick");
    };
  }, [socket]);

  // Redirect to summary when complete
  useEffect(() => {
    if (isComplete) {
      // TODO: Navigate to /match-summary with result data
    }
  }, [isComplete]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>💬 Live Conversation</h1>
        <span className={styles.stateBadge} data-state={state}>
          {state}
        </span>
      </header>

      <div className={styles.content}>
        <div className={styles.chatPanel}>
          <Chat messages={messages} isInputEnabled={false} />
        </div>

        <aside className={styles.sidebar}>
          <CountdownRing
            totalSeconds={TOTAL_SECONDS}
            elapsedSeconds={elapsedSeconds}
          />
          <CompatibilityMeter score={score} />
          {breakdown && (
            <div className={styles.breakdownMini}>
              <div>Profile: {breakdown.preConversation}%</div>
              <div>Personality: {breakdown.personality}%</div>
              <div>Chemistry: {breakdown.flow}%</div>
              <div>Interests: {breakdown.topic}%</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
