import { Router, Request, Response } from "express";
import { config } from "../config";

const router = Router();

const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/**
 * POST /api/tts/synthesize
 * Proxies text-to-speech requests to ElevenLabs.
 * Frontend sends text, backend calls ElevenLabs with the API key,
 * and returns the audio blob.
 */
router.post("/synthesize", async (req: Request, res: Response) => {
  try {
    const { text, voiceId } = req.body as { text: string; voiceId?: string };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text string is required" });
      return;
    }

    if (!config.elevenLabsApiKey) {
      res.status(503).json({ error: "ElevenLabs API key not configured" });
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
      console.error("[TTS] ElevenLabs error:", errorText);
      res.status(response.status).json({ error: "ElevenLabs request failed" });
      return;
    }

    // Stream the audio back to the client
    res.setHeader("Content-Type", "audio/mpeg");
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("[TTS] Synthesis error:", error);
    res.status(500).json({ error: "Failed to synthesize audio" });
  }
});

export default router;
