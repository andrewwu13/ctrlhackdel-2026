import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type {
  GeneratedProfile,
  AgentMode,
  ConversationMessage,
  CoreTopic,
  PersonalitySliders,
} from "./types";

// ── Constants ──────────────────────────────────────────────────────

const SILENCE_MS = 2000;

const ALL_TOPICS: CoreTopic[] = [
  "values",
  "boundaries",
  "lifestyle",
  "communication",
  "goals",
  "dealbreakers",
];

// ── Speech Recognition Types ───────────────────────────────────────

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { 0: SpeechRecognitionAlternativeLike };
type SpeechRecognitionEventLike = { results: SpeechRecognitionResultLike[] };
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// ── Logger ─────────────────────────────────────────────────────────

function log(event: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString().slice(11, 23);
  const extra = data ? ` | ${JSON.stringify(data)}` : "";
  console.log(`[Onboarding ${ts}] ${event}${extra}`);
}

// ── Hook Return ────────────────────────────────────────────────────

export interface ConversationFlowState {
  mode: AgentMode;
  messages: ConversationMessage[];
  agentLine: string;
  liveTranscript: string;
  voiceError: string;
  speechError: string;
  isGeneratingProfile: boolean;
  generationError: string;
  profile: GeneratedProfile;
  personality: PersonalitySliders;
  profileReady: boolean;
  verified: boolean;
  isSpeechSupported: boolean;
  canLaunch: boolean;
  modeLabel: string;
  topicsCovered: CoreTopic[];
  allTopics: CoreTopic[];
  setProfile: React.Dispatch<React.SetStateAction<GeneratedProfile>>;
  setPersonality: React.Dispatch<React.SetStateAction<PersonalitySliders>>;
  setVerified: React.Dispatch<React.SetStateAction<boolean>>;
  regenerateProfile: () => Promise<void>;
  updateListField: (
    field: "coreValues" | "goals" | "dealbreakers" | "interests" | "hobbies" | "lifestyle",
    value: string,
  ) => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const DEFAULT_PROFILE: GeneratedProfile = {
  name: "",
  headline: "",
  bio: "",
  coreValues: [],
  communicationStyle: "",
  goals: [],
  dealbreakers: [],
  interests: [],
  hobbies: [],
  lifestyle: [],
};

const DEFAULT_PERSONALITY: PersonalitySliders = {
  openness: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  emotionalStability: 0.5,
};

// ── Hook ───────────────────────────────────────────────────────────

export function useConversationFlow(
  synthesizeAudio: (text: string) => Promise<Blob | null>,
  converseWithAgent: (
    transcript: string,
    history: ConversationMessage[],
  ) => Promise<{ agentText: string; topicsCovered: CoreTopic[]; isComplete: boolean }>,
  generateProfile: (answers: string[]) => Promise<GeneratedProfile>,
): ConversationFlowState {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const pendingTranscriptRef = useRef("");
  const messagesRef = useRef<ConversationMessage[]>([]);
  const flowTokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [mode, setMode] = useState<AgentMode>("booting");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [agentLine, setAgentLine] = useState("Warming up your agent...");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [topicsCovered, setTopicsCovered] = useState<CoreTopic[]>([]);

  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [profile, setProfile] = useState<GeneratedProfile>(DEFAULT_PROFILE);
  const [personality, setPersonality] =
    useState<PersonalitySliders>(DEFAULT_PERSONALITY);
  const [profileReady, setProfileReady] = useState(false);
  const [verified, setVerified] = useState(false);

  const speechRecognitionCtor = useMemo(() => {
    if (typeof window === "undefined") return null;
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }, []);

  const isSpeechSupported = Boolean(speechRecognitionCtor);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Internal helpers ─────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  const isTokenActive = useCallback(
    (token: number) => flowTokenRef.current === token,
    [],
  );

  const addMessage = useCallback(
    (role: "user" | "agent", content: string) => {
      const msg: ConversationMessage = {
        role,
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [],
  );

  const speakLine = useCallback(
    async (text: string, token: number) => {
      if (!isTokenActive(token)) return;
      setMode("speaking");
      setAgentLine(text);
      setVoiceError("");

      log("Agent speaking", { text: text.slice(0, 100) });

      try {
        const blob = await synthesizeAudio(text);
        if (!isTokenActive(token)) return;

        if (!blob) {
          log("TTS unavailable, using timing fallback");
          await wait(Math.max(900, Math.min(3000, text.length * 25)));
          return;
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        try {
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error("Audio playback failed"));
            audio
              .play()
              .then(() => undefined)
              .catch((e) => reject(e));
          });

          log("Audio playback finished");
        } finally {
          URL.revokeObjectURL(url);
          audioRef.current = null;
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Audio playback error";
        log("Audio error", { error: msg });
        setVoiceError(msg);
        await wait(900);
      }
    },
    [isTokenActive, synthesizeAudio],
  );

  const doGenerateProfile = useCallback(
    async (token: number) => {
      if (!isTokenActive(token)) return;
      setMode("generating");
      setIsGeneratingProfile(true);
      setGenerationError("");
      setAgentLine("Let me put together your profile based on our chat...");

      log("Generating profile", {
        messageCount: messagesRef.current.length,
        topicsCovered: topicsCovered.length,
      });

      try {
        const userAnswers = messagesRef.current
          .filter((m) => m.role === "user")
          .map((m) => m.content);
        const generated = await generateProfile(userAnswers);
        if (!isTokenActive(token)) return;
        setProfile(generated);
        log("Profile generated", { name: generated.name });
      } catch (error) {
        if (!isTokenActive(token)) return;
        const msg =
          error instanceof Error ? error.message : "Profile generation failed";
        log("Profile generation error", { error: msg });
        setGenerationError(msg);
      } finally {
        if (isTokenActive(token)) {
          setIsGeneratingProfile(false);
          setProfileReady(true);
          setMode("review");
        }
      }
    },
    [isTokenActive, generateProfile, topicsCovered.length],
  );

  // Forward-declared via refs
  const handleResponseRef =
    useRef<((token: number) => Promise<void>) | undefined>(undefined);

  const beginListening = useCallback(
    (token: number) => {
      if (!isTokenActive(token)) return;
      stopListening();
      pendingTranscriptRef.current = "";
      setLiveTranscript("");

      if (!speechRecognitionCtor) {
        setSpeechError("Speech recognition requires Chrome or Edge.");
        setMode("thinking");
        log("Speech recognition not supported");
        return;
      }

      setSpeechError("");
      setMode("listening");
      setAgentLine("");
      log("Listening started");

      const recognition = new speechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        if (!isTokenActive(token)) return;
        const pieces: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const chunk = event.results[i][0]?.transcript?.trim();
          if (chunk) pieces.push(chunk);
        }
        const transcript = pieces.join(" ").replace(/\s+/g, " ").trim();
        pendingTranscriptRef.current = transcript;
        setLiveTranscript(transcript);

        if (transcript) {
          clearSilenceTimer();
          silenceTimerRef.current = window.setTimeout(() => {
            void handleResponseRef.current?.(token);
          }, SILENCE_MS);
        }
      };

      recognition.onerror = (event) => {
        if (!isTokenActive(token)) return;
        log("Speech recognition error", { error: event.error });
        setSpeechError(`Mic error: ${event.error}`);
        stopListening();
        // Auto-restart listening after a brief pause
        setTimeout(() => {
          if (isTokenActive(token)) beginListening(token);
        }, 1500);
      };

      recognition.onend = () => {
        if (!isTokenActive(token)) return;
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [isTokenActive, stopListening, clearSilenceTimer, speechRecognitionCtor],
  );

  // Wire up the response handler
  handleResponseRef.current = async (token: number) => {
    if (!isTokenActive(token)) return;
    stopListening();
    const transcript = pendingTranscriptRef.current.trim();
    pendingTranscriptRef.current = "";
    setLiveTranscript("");

    if (!transcript) {
      log("Empty transcript, resuming listening");
      beginListening(token);
      return;
    }

    // Log the STT transcript
    log("STT transcript captured", {
      length: transcript.length,
      text: transcript,
    });

    // Add user message to history
    addMessage("user", transcript);
    setMode("thinking");
    setAgentLine("");

    try {
      // Call backend converse endpoint
      const response = await converseWithAgent(
        transcript,
        messagesRef.current,
      );

      if (!isTokenActive(token)) return;

      log("Agent response received", {
        topicsCovered: response.topicsCovered,
        isComplete: response.isComplete,
      });

      // Update topics
      setTopicsCovered(response.topicsCovered);

      // Add agent message to history
      addMessage("agent", response.agentText);

      // Speak the response
      await speakLine(response.agentText, token);
      if (!isTokenActive(token)) return;

      if (response.isComplete) {
        // All topics covered — generate profile
        await speakLine(
          "Alright, let me put together your profile. One second...",
          token,
        );
        await doGenerateProfile(token);
      } else {
        // Continue listening
        beginListening(token);
      }
    } catch (error) {
      if (!isTokenActive(token)) return;
      const msg =
        error instanceof Error ? error.message : "Conversation turn failed";
      log("Conversation error", { error: msg });
      // Fallback: still continue listening
      setAgentLine("Sorry, I missed that. Go ahead and continue.");
      beginListening(token);
    }
  };

  // ── Boot the conversation ────────────────────────────────────

  useEffect(() => {
    const token = flowTokenRef.current + 1;
    flowTokenRef.current = token;

    const startConversation = async () => {
      setMode("booting");
      setAgentLine("Setting things up...");
      log("Conversation booting");
      await wait(600);
      if (!isTokenActive(token)) return;

      // Get the agent's greeting from the backend
      try {
        const greeting = await converseWithAgent("", []);
        if (!isTokenActive(token)) return;

        log("Greeting received", { text: greeting.agentText.slice(0, 80) });
        addMessage("agent", greeting.agentText);

        await speakLine(greeting.agentText, token);
        if (!isTokenActive(token)) return;

        beginListening(token);
      } catch {
        if (!isTokenActive(token)) return;

        // Fallback greeting
        const fallback =
          "Hey! I'm Soul, your personal agent. I'm excited to get to know you. What's been on your mind lately?";
        addMessage("agent", fallback);
        await speakLine(fallback, token);
        if (!isTokenActive(token)) return;
        beginListening(token);
      }
    };

    void startConversation();

    return () => {
      flowTokenRef.current += 1;
      stopListening();
      audioRef.current?.pause();
      audioRef.current = null;
      log("Conversation cleanup");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ───────────────────────────────────────────────

  const updateListField = useCallback(
    (
      field:
        | "coreValues"
        | "goals"
        | "dealbreakers"
        | "interests"
        | "hobbies"
        | "lifestyle",
      value: string,
    ) => {
      setProfile((prev: GeneratedProfile) => ({
        ...prev,
        [field]: value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }));
    },
    [],
  );

  const regenerateProfile = useCallback(async () => {
    setIsGeneratingProfile(true);
    setGenerationError("");
    log("Regenerating profile");
    try {
      const userAnswers = messagesRef.current
        .filter((m) => m.role === "user")
        .map((m) => m.content);
      const regenerated = await generateProfile(userAnswers);
      setProfile(regenerated);
      log("Profile regenerated");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Regeneration failed";
      log("Regeneration error", { error: msg });
      setGenerationError(msg);
    } finally {
      setIsGeneratingProfile(false);
    }
  }, [generateProfile]);

  const canLaunch =
    verified &&
    Boolean(profile.name.trim()) &&
    Boolean(profile.headline.trim());

  const modeLabel =
    mode === "speaking"
      ? "Soul is talking"
      : mode === "listening"
        ? "Listening to you"
        : mode === "thinking"
          ? "Soul is thinking"
          : mode === "generating"
            ? "Building your profile"
            : "Getting ready";

  return {
    mode,
    messages,
    agentLine,
    liveTranscript,
    voiceError,
    speechError,
    isGeneratingProfile,
    generationError,
    profile,
    personality,
    profileReady,
    verified,
    isSpeechSupported,
    canLaunch,
    modeLabel,
    topicsCovered,
    allTopics: ALL_TOPICS,
    setProfile,
    setPersonality,
    setVerified,
    regenerateProfile,
    updateListField,
  };
}
