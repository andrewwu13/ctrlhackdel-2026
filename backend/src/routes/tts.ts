import { Router, Request, Response } from "express";
import { config } from "../config";

const router = Router();

const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

// Circuit breaker: once quota is exhausted, stop calling ElevenLabs for a while
let ttsDisabledUntil = 0;

/**
 * POST /api/tts/synthesize
 * Proxies text-to-speech requests to ElevenLabs.
 * Falls back gracefully when quota is exhausted — returns { skipped: true }
 * so the frontend uses its text-only timing fallback.
 */
router.post("/synthesize", async (req: Request, res: Response) => {
  try {
    const { text, voiceId } = req.body as { text: string; voiceId?: string };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text string is required" });
      return;
    }

    if (!config.elevenLabsApiKey) {
      console.warn("[TTS] No API key configured — skipping");
      res.status(200).json({ skipped: true, reason: "no_api_key" });
      return;
    }

    // Circuit breaker: skip if quota was recently exhausted
    if (Date.now() < ttsDisabledUntil) {
      res.status(200).json({ skipped: true, reason: "quota_exhausted" });
      return;
    }

    const selectedVoiceId = voiceId || ELEVENLABS_VOICE_ID;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": config.elevenLabsApiKey,
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      // Detect quota exhaustion and activate circuit breaker
      if (errorText.includes("quota_exceeded")) {
        console.warn("[TTS] ElevenLabs quota exhausted — disabling TTS for 5 minutes");
        ttsDisabledUntil = Date.now() + 5 * 60 * 1000;
        res.status(200).json({ skipped: true, reason: "quota_exhausted" });
        return;
      }

      console.error("[TTS] ElevenLabs error:", errorText);
      res.status(200).json({ skipped: true, reason: "api_error" });
      return;
    }

    // Stream the audio back to the client
    res.setHeader("Content-Type", "audio/mpeg");
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("[TTS] Synthesis error:", error);
    res.status(200).json({ skipped: true, reason: "error" });
  }
});

export default router;

