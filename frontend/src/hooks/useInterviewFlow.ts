import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { GeneratedProfile, AgentMode, InterviewQuestion } from "./types";

// ── Questions ──────────────────────────────────────────────────────

const QUESTIONS: InterviewQuestion[] = [
  {
    id: "identity",
    section: "Soul Vector",
    prompt:
      "Tell me who you are at your best and what kind of impact you want to have.",
  },
  {
    id: "values",
    section: "Soul Vector",
    prompt:
      "What values are non-negotiable for you in relationships, work, and life decisions?",
  },
  {
    id: "compatibility",
    section: "Soul Vector",
    prompt:
      "What type of person do you connect with most naturally, and what usually causes friction for you?",
  },
  {
    id: "voice",
    section: "Voice Imprint",
    prompt:
      "How do you like to communicate when things are calm and when things are emotionally intense?",
  },
  {
    id: "mission",
    section: "Voice Imprint",
    prompt:
      "What are your top personal and professional goals for the next 12 months?",
  },
  {
    id: "boundaries",
    section: "Voice Imprint",
    prompt:
      "What boundaries should your agent always protect when representing you?",
  },
];

const SILENCE_MS = 1700;

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

// ── Hook Return ────────────────────────────────────────────────────

export interface InterviewFlowState {
  mode: AgentMode;
  questionIndex: number;
  answers: string[];
  agentLine: string;
  voiceError: string;
  speechError: string;
  isGeneratingProfile: boolean;
  generationError: string;
  profile: GeneratedProfile;
  profileReady: boolean;
  verified: boolean;
  isSpeechSupported: boolean;
  canLaunch: boolean;
  modeLabel: string;
  totalQuestions: number;
  setProfile: React.Dispatch<React.SetStateAction<GeneratedProfile>>;
  setVerified: React.Dispatch<React.SetStateAction<boolean>>;
  regenerateProfile: () => Promise<void>;
  updateListField: (
    field: "coreValues" | "goals" | "dealbreakers",
    value: string,
  ) => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const buildReflection = (answer: string) => {
  const clean = answer.replace(/\s+/g, " ").trim();
  if (!clean) return "Thank you for sharing that.";
  const sentence = clean.split(/[.!?]/)[0]?.trim() || clean;
  const clipped =
    sentence.length > 100 ? `${sentence.slice(0, 100)}...` : sentence;
  return `Thank you. I heard that ${clipped.charAt(0).toLowerCase()}${clipped.slice(1)} is important to you.`;
};

const DEFAULT_PROFILE: GeneratedProfile = {
  name: "",
  headline: "",
  bio: "",
  coreValues: [],
  communicationStyle: "",
  goals: [],
  dealbreakers: [],
};

// ── Hook ───────────────────────────────────────────────────────────

export function useInterviewFlow(
  synthesizeAudio: (text: string) => Promise<Blob | null>,
  generateProfile: (answers: string[]) => Promise<GeneratedProfile>,
): InterviewFlowState {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const pendingTranscriptRef = useRef("");
  const answersRef = useRef<string[]>(Array(QUESTIONS.length).fill(""));
  const flowTokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [mode, setMode] = useState<AgentMode>("booting");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(
    Array(QUESTIONS.length).fill(""),
  );
  const [agentLine, setAgentLine] = useState(
    "Warming up your agent interface...",
  );
  const [voiceError, setVoiceError] = useState("");
  const [speechError, setSpeechError] = useState("");

  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [profile, setProfile] = useState<GeneratedProfile>(DEFAULT_PROFILE);
  const [profileReady, setProfileReady] = useState(false);
  const [verified, setVerified] = useState(false);

  const speechRecognitionCtor = useMemo(() => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }, []);

  const isSpeechSupported = Boolean(speechRecognitionCtor);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

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

  const setAnswerAtIndex = useCallback((index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const speakLine = useCallback(
    async (text: string, token: number) => {
      if (!isTokenActive(token)) return;
      setMode("speaking");
      setAgentLine(text);
      setVoiceError("");

      try {
        const blob = await synthesizeAudio(text);
        if (!isTokenActive(token)) return;

        if (!blob) {
          await wait(Math.max(900, Math.min(2600, text.length * 22)));
          return;
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio
            .play()
            .then(() => undefined)
            .catch((e) => reject(e));
        });

        URL.revokeObjectURL(url);
        audioRef.current = null;
      } catch (error) {
        setVoiceError(
          error instanceof Error
            ? error.message
            : "Unable to play ElevenLabs audio",
        );
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
      setAgentLine(
        "Generating and validating your profile from this conversation...",
      );

      try {
        const generated = await generateProfile(answersRef.current);
        if (!isTokenActive(token)) return;
        setProfile(generated);
      } catch (error) {
        if (!isTokenActive(token)) return;
        setGenerationError(
          error instanceof Error ? error.message : "Profile generation failed",
        );
      } finally {
        if (!isTokenActive(token)) return;
        setIsGeneratingProfile(false);
        setProfileReady(true);
        setMode("review");
      }
    },
    [isTokenActive, generateProfile],
  );

  // Forward-declared via refs to break circular dependency
  const handleResponseRef =
    useRef<((index: number, token: number) => Promise<void>) | undefined>(undefined);
  const retryQuestionRef =
    useRef<
      ((index: number, token: number, preface: string) => Promise<void>) | undefined
    >(undefined);

  const beginListeningForQuestion = useCallback(
    (index: number, token: number) => {
      if (!isTokenActive(token)) return;
      stopListening();
      pendingTranscriptRef.current = "";

      if (!speechRecognitionCtor) {
        setSpeechError(
          "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
        );
        setMode("thinking");
        setAgentLine(
          "I need speech recognition support to continue this live interview.",
        );
        return;
      }

      setSpeechError("");
      setMode("listening");
      setAgentLine("I am listening. Respond naturally when you are ready.");

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

        if (transcript) {
          clearSilenceTimer();
          silenceTimerRef.current = window.setTimeout(() => {
            void handleResponseRef.current?.(index, token);
          }, SILENCE_MS);
        }
      };

      recognition.onerror = (event) => {
        if (!isTokenActive(token)) return;
        setSpeechError(`Transcription error: ${event.error}`);
        stopListening();
        void retryQuestionRef.current?.(
          index,
          token,
          "I had trouble hearing that. Let us try that answer again.",
        );
      };

      recognition.onend = () => {
        if (!isTokenActive(token)) return;
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [
      isTokenActive,
      stopListening,
      clearSilenceTimer,
      speechRecognitionCtor,
    ],
  );

  // Wire up the ref-based callbacks
  retryQuestionRef.current = async (
    index: number,
    token: number,
    preface: string,
  ) => {
    if (!isTokenActive(token)) return;
    setMode("thinking");
    await speakLine(preface, token);
    if (!isTokenActive(token)) return;
    await speakLine(QUESTIONS[index].prompt, token);
    beginListeningForQuestion(index, token);
  };

  handleResponseRef.current = async (index: number, token: number) => {
    if (!isTokenActive(token)) return;
    stopListening();
    const transcript = pendingTranscriptRef.current.trim();
    pendingTranscriptRef.current = "";

    if (!transcript) {
      await retryQuestionRef.current?.(
        index,
        token,
        "I did not catch that. Please answer one more time.",
      );
      return;
    }

    setAnswerAtIndex(index, transcript);
    setMode("thinking");

    const reflection = buildReflection(transcript);
    await speakLine(reflection, token);
    if (!isTokenActive(token)) return;

    if (index >= QUESTIONS.length - 1) {
      await speakLine("Thank you. I have everything I need.", token);
      await doGenerateProfile(token);
      return;
    }

    const nextIndex = index + 1;
    setQuestionIndex(nextIndex);
    await speakLine(`Next question. ${QUESTIONS[nextIndex].prompt}`, token);
    if (!isTokenActive(token)) return;
    beginListeningForQuestion(nextIndex, token);
  };

  // ── Boot the interview ───────────────────────────────────────

  useEffect(() => {
    const token = flowTokenRef.current + 1;
    flowTokenRef.current = token;

    const startInterview = async () => {
      setMode("booting");
      setAgentLine("Initializing Soul Agent...");
      await wait(800);
      if (!isTokenActive(token)) return;

      setQuestionIndex(0);
      await speakLine(
        "Hi, I am your Soul Agent. I will ask six short questions and listen to your live answers.",
        token,
      );
      if (!isTokenActive(token)) return;

      await speakLine(QUESTIONS[0].prompt, token);
      if (!isTokenActive(token)) return;

      beginListeningForQuestion(0, token);
    };

    void startInterview();

    return () => {
      flowTokenRef.current += 1;
      stopListening();
      audioRef.current?.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ───────────────────────────────────────────────

  const updateListField = useCallback(
    (field: "coreValues" | "goals" | "dealbreakers", value: string) => {
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
    try {
      const regenerated = await generateProfile(answersRef.current);
      setProfile(regenerated);
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Unable to regenerate profile",
      );
    } finally {
      setIsGeneratingProfile(false);
    }
  }, [generateProfile]);

  const canLaunch =
    verified && Boolean(profile.name.trim()) && Boolean(profile.headline.trim());

  const modeLabel =
    mode === "speaking"
      ? "Agent speaking"
      : mode === "listening"
        ? "Agent listening"
        : mode === "thinking"
          ? "Agent reflecting"
          : mode === "generating"
            ? "Generating profile"
            : "Initializing";

  return {
    mode,
    questionIndex,
    answers,
    agentLine,
    voiceError,
    speechError,
    isGeneratingProfile,
    generationError,
    profile,
    profileReady,
    verified,
    isSpeechSupported,
    canLaunch,
    modeLabel,
    totalQuestions: QUESTIONS.length,
    setProfile,
    setVerified,
    regenerateProfile,
    updateListField,
  };
}
