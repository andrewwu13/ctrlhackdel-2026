import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import AgentAvatar from "@/components/AgentAvatar";
import { Check, Loader2, RefreshCw } from "lucide-react";

type InterviewQuestion = {
  id: string;
  section: "Soul Vector" | "Voice Imprint";
  prompt: string;
};

type GeneratedProfile = {
  name: string;
  headline: string;
  bio: string;
  coreValues: string[];
  communicationStyle: string;
  goals: string[];
  dealbreakers: string[];
};

type AgentMode = "booting" | "speaking" | "listening" | "thinking" | "generating" | "review";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultLike[];
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

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

const QUESTIONS: InterviewQuestion[] = [
  {
    id: "identity",
    section: "Soul Vector",
    prompt: "Tell me who you are at your best and what kind of impact you want to have.",
  },
  {
    id: "values",
    section: "Soul Vector",
    prompt: "What values are non-negotiable for you in relationships, work, and life decisions?",
  },
  {
    id: "compatibility",
    section: "Soul Vector",
    prompt: "What type of person do you connect with most naturally, and what usually causes friction for you?",
  },
  {
    id: "voice",
    section: "Voice Imprint",
    prompt: "How do you like to communicate when things are calm and when things are emotionally intense?",
  },
  {
    id: "mission",
    section: "Voice Imprint",
    prompt: "What are your top personal and professional goals for the next 12 months?",
  },
  {
    id: "boundaries",
    section: "Voice Imprint",
    prompt: "What boundaries should your agent always protect when representing you?",
  },
];

const DEFAULT_PROFILE: GeneratedProfile = {
  name: "",
  headline: "",
  bio: "",
  coreValues: [],
  communicationStyle: "",
  goals: [],
  dealbreakers: [],
};

const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const SILENCE_MS = 1700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const extractJsonFromText = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
};

const fallbackProfile = (answers: string[]): GeneratedProfile => {
  const combined = answers.join(" ").trim();
  return {
    name: "User",
    headline: "Mission-driven collaborator",
    bio: combined.slice(0, 350) || "Profile created from interview answers.",
    coreValues: ["Empathy", "Growth", "Integrity"],
    communicationStyle: "Clear, respectful, and direct",
    goals: ["Build meaningful relationships", "Stay aligned with long-term priorities"],
    dealbreakers: ["Dishonesty", "Disrespect", "Value misalignment"],
  };
};

const buildReflection = (answer: string) => {
  const clean = answer.replace(/\s+/g, " ").trim();
  if (!clean) return "Thank you for sharing that.";

  const sentence = clean.split(/[.!?]/)[0]?.trim() || clean;
  const clipped = sentence.length > 100 ? `${sentence.slice(0, 100)}...` : sentence;
  return `Thank you. I heard that ${clipped.charAt(0).toLowerCase()}${clipped.slice(1)} is important to you.`;
};

const synthesizeAudio = async (text: string) => {
  const apiKey = "9c148b2cb8a31dafc2d2c65b94935334d9a58b32daf02efe26800d09cedafd8e";
  if (!apiKey) return null;

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.72,
        similarity_boost: 0.78,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ElevenLabs request failed: ${message}`);
  }

  return response.blob();
};

const generateProfileFromGemini = async (answers: string[]): Promise<GeneratedProfile> => {
  const apiKey = "AIzaSyDntMz-yNM6nAS8jTGz43CVfk6GQPhZ8tQ";
  if (!apiKey) {
    return fallbackProfile(answers);
  }

  const prompt = `You are generating a user profile for an autonomous personal agent.
Return valid JSON only with this exact schema:
{
  "name": "string",
  "headline": "string",
  "bio": "string",
  "coreValues": ["string"],
  "communicationStyle": "string",
  "goals": ["string"],
  "dealbreakers": ["string"]
}
Use the interview answers below and infer reasonable defaults when details are missing.
Interview answers:\n${answers.map((answer, i) => `${i + 1}. ${answer}`).join("\n")}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini request failed: ${message}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const rawJson = extractJsonFromText(text);
  if (!rawJson) {
    throw new Error("Unable to parse Gemini JSON response");
  }

  const parsed = JSON.parse(rawJson) as Partial<GeneratedProfile>;

  return {
    name: parsed.name?.trim() || "User",
    headline: parsed.headline?.trim() || "Intentional and values-driven",
    bio: parsed.bio?.trim() || fallbackProfile(answers).bio,
    coreValues: (parsed.coreValues || []).filter(Boolean),
    communicationStyle: parsed.communicationStyle?.trim() || "Clear and collaborative",
    goals: (parsed.goals || []).filter(Boolean),
    dealbreakers: (parsed.dealbreakers || []).filter(Boolean),
  };
};

const Onboarding = () => {
  const navigate = useNavigate();

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const pendingTranscriptRef = useRef("");
  const answersRef = useRef<string[]>(Array(QUESTIONS.length).fill(""));
  const flowTokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [mode, setMode] = useState<AgentMode>("booting");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(""));
  const [agentLine, setAgentLine] = useState("Warming up your agent interface...");
  const [voiceError, setVoiceError] = useState("");
  const [speechError, setSpeechError] = useState("");

  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [profile, setProfile] = useState<GeneratedProfile>(DEFAULT_PROFILE);
  const [profileReady, setProfileReady] = useState(false);
  const [verified, setVerified] = useState(false);

  const speechRecognitionCtor = useMemo(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }, []);

  const isSpeechSupported = Boolean(speechRecognitionCtor);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    clearSilenceTimer();
  };

  const isTokenActive = (token: number) => flowTokenRef.current === token;

  const setAnswerAtIndex = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const speakLine = async (text: string, token: number) => {
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
          .catch((error) => reject(error));
      });

      URL.revokeObjectURL(url);
      audioRef.current = null;
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Unable to play ElevenLabs audio");
      await wait(900);
    }
  };

  const generateProfile = async (token: number) => {
    if (!isTokenActive(token)) return;

    setMode("generating");
    setIsGeneratingProfile(true);
    setGenerationError("");
    setAgentLine("Generating and validating your profile from this conversation...");

    try {
      const generated = await generateProfileFromGemini(answersRef.current);
      if (!isTokenActive(token)) return;
      setProfile(generated);
    } catch (error) {
      if (!isTokenActive(token)) return;
      setProfile(fallbackProfile(answersRef.current));
      setGenerationError(error instanceof Error ? error.message : "Profile generation failed");
    } finally {
      if (!isTokenActive(token)) return;
      setIsGeneratingProfile(false);
      setProfileReady(true);
      setMode("review");
    }
  };

  const beginListeningForQuestion = (index: number, token: number) => {
    if (!isTokenActive(token)) return;

    stopListening();
    pendingTranscriptRef.current = "";

    if (!speechRecognitionCtor) {
      setSpeechError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      setMode("thinking");
      setAgentLine("I need speech recognition support to continue this live interview.");
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
          void handleResponse(index, token);
        }, SILENCE_MS);
      }
    };

    recognition.onerror = (event) => {
      if (!isTokenActive(token)) return;
      setSpeechError(`Transcription error: ${event.error}`);
      stopListening();
      void retryQuestion(index, token, "I had trouble hearing that. Let us try that answer again.");
    };

    recognition.onend = () => {
      if (!isTokenActive(token)) return;
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const retryQuestion = async (index: number, token: number, preface: string) => {
    if (!isTokenActive(token)) return;
    setMode("thinking");
    await speakLine(preface, token);
    if (!isTokenActive(token)) return;
    await speakLine(QUESTIONS[index].prompt, token);
    beginListeningForQuestion(index, token);
  };

  const handleResponse = async (index: number, token: number) => {
    if (!isTokenActive(token)) return;

    stopListening();
    const transcript = pendingTranscriptRef.current.trim();
    pendingTranscriptRef.current = "";

    if (!transcript) {
      await retryQuestion(index, token, "I did not catch that. Please answer one more time.");
      return;
    }

    setAnswerAtIndex(index, transcript);
    setMode("thinking");

    const reflection = buildReflection(transcript);
    await speakLine(reflection, token);
    if (!isTokenActive(token)) return;

    if (index >= QUESTIONS.length - 1) {
      await speakLine("Thank you. I have everything I need.", token);
      await generateProfile(token);
      return;
    }

    const nextIndex = index + 1;
    setQuestionIndex(nextIndex);
    await speakLine(`Next question. ${QUESTIONS[nextIndex].prompt}`, token);
    if (!isTokenActive(token)) return;
    beginListeningForQuestion(nextIndex, token);
  };

  const startInterview = async (token: number) => {
    setMode("booting");
    setAgentLine("Initializing Soul Agent...");

    await wait(800);
    if (!isTokenActive(token)) return;

    setQuestionIndex(0);
    await speakLine("Hi, I am your Soul Agent. I will ask six short questions and listen to your live answers.", token);
    if (!isTokenActive(token)) return;

    await speakLine(QUESTIONS[0].prompt, token);
    if (!isTokenActive(token)) return;

    beginListeningForQuestion(0, token);
  };

  useEffect(() => {
    const token = flowTokenRef.current + 1;
    flowTokenRef.current = token;

    void startInterview(token);

    return () => {
      flowTokenRef.current += 1;
      stopListening();
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const updateListField = (field: "coreValues" | "goals" | "dealbreakers", value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    }));
  };

  const canLaunch = verified && Boolean(profile.name.trim()) && Boolean(profile.headline.trim());

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

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 min-h-screen px-4 py-8 flex items-center justify-center">
        {!profileReady ? (
          <div className="w-full max-w-4xl space-y-8">
            <div className="text-center space-y-2">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
                Live <span className="text-gradient-rose">Agent Interview</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">No forms. No chat controls. Just live voice conversation.</p>
            </div>

            <div className="flex justify-center">
              <AgentAvatar mode={mode === "review" ? "thinking" : mode} />
            </div>

            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl mx-auto text-center space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-mono uppercase tracking-[0.22em] text-accent">{modeLabel}</p>
              <p className="text-foreground text-lg md:text-xl leading-relaxed">{agentLine}</p>

              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(questionIndex / QUESTIONS.length) * 100}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Question {Math.min(questionIndex + 1, QUESTIONS.length)} / {QUESTIONS.length}</p>

              {voiceError ? <p className="text-sm text-destructive">{voiceError}</p> : null}
              {speechError ? <p className="text-sm text-destructive">{speechError}</p> : null}
              {!isSpeechSupported ? (
                <p className="text-sm text-destructive">Speech recognition requires Chrome or Edge.</p>
              ) : null}
            </motion.div>
          </div>
        ) : (
          <motion.div
            key="profile-review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-6 md:p-8 space-y-5 max-w-3xl mx-auto w-full"
          >
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold text-foreground">
                Review Your <span className="text-gradient-rose">Agent Profile</span>
              </h2>
              <p className="text-muted-foreground">Verify or edit details below, then launch your agent.</p>
            </div>

            {generationError && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-300">
                API fallback used: {generationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
                className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
              />
              <input
                value={profile.headline}
                onChange={(e) => setProfile((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder="Headline"
                className="rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
              />
            </div>

            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Bio"
              className="w-full min-h-28 rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
            />

            <input
              value={profile.coreValues.join(", ")}
              onChange={(e) => updateListField("coreValues", e.target.value)}
              placeholder="Core values (comma separated)"
              className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
            />

            <input
              value={profile.communicationStyle}
              onChange={(e) => setProfile((prev) => ({ ...prev, communicationStyle: e.target.value }))}
              placeholder="Communication style"
              className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
            />

            <input
              value={profile.goals.join(", ")}
              onChange={(e) => updateListField("goals", e.target.value)}
              placeholder="Goals (comma separated)"
              className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
            />

            <input
              value={profile.dealbreakers.join(", ")}
              onChange={(e) => updateListField("dealbreakers", e.target.value)}
              placeholder="Dealbreakers (comma separated)"
              className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none"
            />

            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="w-4 h-4"
              />
              I verify this profile is accurate and ready for agent launch.
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={async () => {
                  setIsGeneratingProfile(true);
                  setGenerationError("");
                  try {
                    const regenerated = await generateProfileFromGemini(answersRef.current);
                    setProfile(regenerated);
                  } catch (error) {
                    setGenerationError(error instanceof Error ? error.message : "Unable to regenerate profile");
                  } finally {
                    setIsGeneratingProfile(false);
                  }
                }}
                disabled={isGeneratingProfile}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerate
              </button>

              <button
                onClick={() => navigate("/lounge")}
                disabled={!canLaunch}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
              >
                <Check className="w-4 h-4" />
                Launch Your Agent
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
