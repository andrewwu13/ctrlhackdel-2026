import { config } from "../config";

/**
 * ElevenLabs integration stubs.
 *
 * During onboarding:
 *   User speaks → STT to text → extract speech style markers → shape agent tone
 * During agent conversation:
 *   Optional TTS for demo playback
 */

// ── Speech-to-Text ─────────────────────────────────────────────────

export interface STTResult {
  text: string;
  confidence: number;
  speechStyleMarkers: string[];
}

/**
 * Convert audio to text using ElevenLabs STT.
 * Also extracts speech style markers (pace, tone, formality).
 */
export async function speechToText(_audioBuffer: Buffer): Promise<STTResult> {
  if (!config.elevenLabsApiKey) {
    console.warn("[ElevenLabs] No API key configured — returning stub result");
    return { text: "", confidence: 0, speechStyleMarkers: [] };
  }

  // TODO: Call ElevenLabs STT API
  // const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
  //   method: "POST",
  //   headers: {
  //     "xi-api-key": config.elevenLabsApiKey,
  //   },
  //   body: audioBuffer,
  // });

  console.log("[ElevenLabs] STT stub — not yet implemented");
  return {
    text: "",
    confidence: 0,
    speechStyleMarkers: [],
  };
}

// ── Text-to-Speech ─────────────────────────────────────────────────

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

/**
 * Convert text to speech using ElevenLabs TTS.
 * Returns an audio buffer.
 */
export async function textToSpeech(
  _text: string,
  _options?: TTSOptions
): Promise<Buffer> {
  if (!config.elevenLabsApiKey) {
    console.warn("[ElevenLabs] No API key configured — returning empty buffer");
    return Buffer.alloc(0);
  }

  // TODO: Call ElevenLabs TTS API
  // const response = await fetch(
  //   `https://api.elevenlabs.io/v1/text-to-speech/${options?.voiceId || "default"}`,
  //   {
  //     method: "POST",
  //     headers: {
  //       "xi-api-key": config.elevenLabsApiKey,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       text,
  //       model_id: options?.modelId || "eleven_monolingual_v1",
  //       voice_settings: {
  //         stability: options?.stability || 0.5,
  //         similarity_boost: options?.similarityBoost || 0.75,
  //       },
  //     }),
  //   }
  // );

  console.log("[ElevenLabs] TTS stub — not yet implemented");
  return Buffer.alloc(0);
}
