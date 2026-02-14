"use client";

import { useState, useRef, useEffect } from "react";
import type { Message } from "@/lib/types";
import styles from "./Chat.module.css";

interface ChatProps {
  messages: Message[];
  onSendMessage?: (content: string) => void;
  isInputEnabled?: boolean;
  placeholder?: string;
}

export default function Chat({
  messages,
  onSendMessage,
  isInputEnabled = true,
  placeholder = "Type a message...",
}: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !onSendMessage) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className={styles.container}>
      <div className={styles.messageList}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${styles[msg.sender]}`}
          >
            <span className={styles.sender}>{msg.sender}</span>
            <p className={styles.content}>{msg.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isInputEnabled && onSendMessage && (
        <form className={styles.inputForm} onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className={styles.input}
          />
          <button type="submit" className={styles.sendButton}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
