"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "@/components/Chat";
import ProfileSliders from "@/components/ProfileSliders";
import { useSocket } from "@/hooks/useSocket";
import { api } from "@/lib/api";
import type { Message, OnboardingQuestion } from "@/lib/types";
import styles from "./page.module.css";

export default function OnboardingPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<OnboardingQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  const { socket, isConnected, emit } = useSocket({
    namespace: "/onboarding",
    query: sessionId ? { sessionId } : undefined,
    autoConnect: false,
  });

  // Start onboarding session
  useEffect(() => {
    api.startOnboarding().then((res) => {
      setSessionId(res.sessionId);
    });
  }, []);

  // Connect socket once we have a session ID
  useEffect(() => {
    if (sessionId && socket && !isConnected) {
      socket.connect();
    }
  }, [sessionId, socket, isConnected]);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("question", (data: OnboardingQuestion) => {
      setCurrentQuestion(data);
      setQuestionIndex(data.index);
      setMessages((prev) => [
        ...prev,
        {
          id: `q-${data.index}`,
          sessionId: sessionId || "",
          sender: "system",
          content: data.text,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    socket.on("response", (data: { content: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `r-${Date.now()}`,
          sessionId: sessionId || "",
          sender: "agent_a",
          content: data.content,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    return () => {
      socket.off("question");
      socket.off("response");
    };
  }, [socket, sessionId]);

  const handleSendMessage = useCallback(
    (content: string) => {
      // Add user message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          sessionId: sessionId || "",
          sender: "agent_b", // user
          content,
          timestamp: new Date().toISOString(),
        },
      ]);
      emit("message", { content });
    },
    [emit, sessionId]
  );

  const handleProfileChange = useCallback(
    (values: Record<string, number>) => {
      emit("update_profile", values);
    },
    [emit]
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>✨ Let&apos;s Get to Know You</h1>
        {currentQuestion && (
          <p className={styles.progress}>
            Question {questionIndex + 1} of {currentQuestion.total}
          </p>
        )}
      </header>

      <div className={styles.content}>
        <div className={styles.chatPanel}>
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isInputEnabled={isConnected}
            placeholder="Tell us about yourself..."
          />
        </div>

        <aside className={styles.sidebar}>
          <ProfileSliders onChange={handleProfileChange} />
        </aside>
      </div>
    </div>
  );
}
