/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

class BoundedMap<K, V> extends Map<K, V> {
  maxEntries: number;
  constructor(maxEntries: number) {
    super();
    this.maxEntries = maxEntries;
  }
  set(key: K, value: V): this {
    if (this.has(key)) {
      this.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    return super.set(key, value);
  }
}

function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) {
      continue;
    }
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}

const MODEL_UPGRADES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-4-hydrogen",
  "gemini-2.5-pro": "gemini-4-argon",
  "gemini-3-flash-preview": "gemini-4-hydrogen",
  "gemini-3-pro-preview": "gemini-4-argon",
  "gemini-3.1-pro-preview": "gemini-4-argon",
  "gemini-2.5-pro-preview-tts": "gemini-3.8-flash-tts",
  "gemini-2.5-flash-preview-tts": "gemini-3.8-flash-lite-tts",
};

const ALLOWED_MODEL_RE =
  /^(?!.*\.\.)(?:models\/)?(?:gemini-|imagen-|veo-|lyria-|learnlm-|text-embedding-|gemini-embedding-)[a-zA-Z0-9._-]+$/;

function resolveModel(model?: string): string {
  const candidate = !model ? "gemini-4-hydrogen" : MODEL_UPGRADES[model] || model;
  if (!ALLOWED_MODEL_RE.test(candidate)) {
    throw new Error(`Disallowed model: ${candidate}`);
  }
  return candidate;
}

function createGenAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      apiVersion: "v1beta",
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function ensureWavBuffer(rawBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  // Check for RIFF header
  if (rawBuffer.length >= 12 && rawBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return rawBuffer;
  }
  const dataSize = rawBuffer.length;
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, rawBuffer]);
}

function extractDurationSec(wavBuffer: Buffer): number {
  const pcmBytes = Math.max(0, wavBuffer.length - 44);
  const bytesPerSecond = 24000 * 2; // 24kHz mono 16-bit
  return Number((pcmBytes / bytesPerSecond).toFixed(2));
}

function formatGeminiError(error: any): { status: number; message: string } {
  const rawMessage = error?.message || String(error || "Unknown error");
  if (rawMessage === "API_KEY_MISSING") {
    return {
      status: 503,
      message: "Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("429") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Rate limit or API quota reached. Please wait a moment and try again.",
    };
  }
  if (rawMessage.includes("403") || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "API key permission error. Please verify your GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("503") || rawMessage.includes("UNAVAILABLE")) {
    return {
      status: 503,
      message: "The AI model is experiencing temporary high demand. Please try again in a few seconds.",
    };
  }
  return {
    status: 500,
    message: rawMessage || "Failed to generate audio. Please try again.",
  };
}

function serializeGenerateContentResponse(r: any) {
  return {
    candidates: r?.candidates,
    promptFeedback: r?.promptFeedback,
    usageMetadata: r?.usageMetadata,
    modelVersion: r?.modelVersion,
    responseId: r?.responseId,
    text: r?.text,
    functionCalls: r?.functionCalls,
    data: r?.data,
    executableCode: r?.executableCode,
    codeExecutionResult: r?.codeExecutionResult,
  };
}

const chats = new BoundedMap<string, any>(200);
const previewCache = new BoundedMap<string, { audioBase64: string; durationSec: number }>(200);

function getClientKey(req: any): string {
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(raw.trim())) {
    return `cid:${raw.trim()}`;
  }
  const xffParts = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const xff = xffParts.length >= 2 ? xffParts[xffParts.length - 2] : xffParts[0] || "";
  return `ip:${xff || req?.ip || req?.socket?.remoteAddress || "unknown"}`;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = process.env.NODE_ENV === "production" ? Number(process.env.PORT) || 3000 : 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  for (const dir of ["examples", "assets", "public"]) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath));
    }
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Dedicated TTS generation endpoint using Gemini 3.8 TTS models
  app.post("/api/tts/generate", async (req, res): Promise<any> => {
    try {
      const ai = createGenAiClient();
      const {
        text,
        stylePrompt,
        voiceName = "Kore",
        secondVoiceName = "Puck",
        firstSpeakerName = "Speaker 1",
        secondSpeakerName = "Speaker 2",
        secondSpeakerText = "",
        secondSpeakerStyle = "",
        isMultiSpeaker = false,
        model = "gemini-3.8-flash-lite-tts",
        language = "Auto",
      } = req.body || {};

      const cleanText = typeof text === "string" ? text.trim() : "";
      if (!cleanText || cleanText.length > 5500) {
        return res.status(400).json({ error: "Please provide script text between 1 and 5,500 characters." });
      }

      const selectedModel =
        isMultiSpeaker || model === "gemini-3.8-flash-tts"
          ? "gemini-3.8-flash-tts"
          : "gemini-3.8-flash-lite-tts";

      const languageHint =
        language && language !== "Auto"
          ? `Native ${language} pronunciation with natural human breath pauses and authentic intonation.`
          : "Natural human cadence, subtle breath pauses, and expressive intonation.";

      const combinedStyle = [typeof stylePrompt === "string" ? stylePrompt.trim() : "", languageHint]
        .filter(Boolean)
        .join(" ");

      let response: any;

      if (isMultiSpeaker) {
        const s1 = (typeof firstSpeakerName === "string" && firstSpeakerName.trim()) || "Alex";
        const s2 = (typeof secondSpeakerName === "string" && secondSpeakerName.trim()) || "Sam";
        const cleanSecondText =
          typeof secondSpeakerText === "string" && secondSpeakerText.trim()
            ? secondSpeakerText.trim()
            : "That sounds really exciting! Tell me more about how that works.";

        response = await ai.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${s1}: ${cleanText}`,
                  speechMetadata: {
                    speaker: s1,
                    style: combinedStyle,
                  },
                } as any,
                {
                  text: `${s2}: ${cleanSecondText}`,
                  speechMetadata: {
                    speaker: s2,
                    style:
                      (typeof secondSpeakerStyle === "string" && secondSpeakerStyle.trim()) ||
                      `Conversational, natural co-host response. ${languageHint}`,
                  },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: s1,
                    voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                  },
                  {
                    speaker: s2,
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: secondVoiceName } },
                  },
                ],
              },
            },
          },
        });
      } else {
        response = await ai.models.generateContent({
          model: selectedModel,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: combinedStyle,
                  },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });
      }

      const audioData = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return res.status(502).json({
          error: "The speech model did not return audio data. Please try adjusting your text or style prompt.",
        });
      }

      const wavBuffer = ensureWavBuffer(Buffer.from(audioData, "base64"));
      const durationSec = extractDurationSec(wavBuffer);

      return res.json({
        audioBase64: wavBuffer.toString("base64"),
        mimeType: "audio/wav",
        durationSec,
        model: selectedModel,
      });
    } catch (error: any) {
      console.error("[Backend] /api/tts/generate error:", error);
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Fast cached voice preview endpoint
  app.post("/api/tts/preview", async (req, res): Promise<any> => {
    try {
      const { voiceId, voiceName = "Kore", sampleText, stylePrompt } = req.body || {};
      const cacheKey = String(voiceId || `${voiceName}:${sampleText}`).slice(0, 140);

      const cached = previewCache.get(cacheKey);
      if (cached) {
        return res.json({ ...cached, mimeType: "audio/wav", cached: true });
      }

      const ai = createGenAiClient();
      const textToSpeak =
        (typeof sampleText === "string" && sampleText.trim().slice(0, 260)) ||
        `Hello, I am ${voiceName}. Listen to how naturally I bring your words to life.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: textToSpeak,
                speechMetadata: {
                  style:
                    (typeof stylePrompt === "string" && stylePrompt.trim()) ||
                    "Natural human studio voice with clear diction and subtle breath pauses.",
                },
              } as any,
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioData = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return res.status(502).json({ error: "Preview audio could not be generated." });
      }

      const wavBuffer = ensureWavBuffer(Buffer.from(audioData, "base64"));
      const payload = {
        audioBase64: wavBuffer.toString("base64"),
        durationSec: extractDurationSec(wavBuffer),
      };
      previewCache.set(cacheKey, payload);

      return res.json({ ...payload, mimeType: "audio/wav", cached: false });
    } catch (error: any) {
      console.error("[Backend] /api/tts/preview error:", error);
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // AI Voice Casting Assistant powered by gemini-4-hydrogen
  app.post("/api/tts/cast", async (req, res): Promise<any> => {
    try {
      const ai = createGenAiClient();
      const { query, voicesSummary } = req.body || {};
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Please describe the voice or mood you want." });
      }

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `You are an expert voice casting director for a Text-to-Speech studio.
User request: "${query.slice(0, 600)}"

Available voices catalog (subset):
${JSON.stringify(voicesSummary || []).slice(0, 12000)}

Return the top 3 matching voice IDs from the catalog, a concise natural stylePrompt (under 250 chars) for speechMetadata.style (capturing tone, pacing, breath, and emotion), and a short realistic sampleScript (1-2 sentences in the matching language/mood).`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedVoiceIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 3 matching voice IDs from the catalog",
              },
              stylePrompt: {
                type: Type.STRING,
                description: "Concise natural voice direction prompt",
              },
              sampleScript: {
                type: Type.STRING,
                description: "Sample 1-2 sentence script matching the user's requested style/language",
              },
              rationale: {
                type: Type.STRING,
                description: "Brief 1-sentence reason why these voices fit",
              },
            },
            required: ["recommendedVoiceIds", "stylePrompt", "sampleScript", "rationale"],
          },
        },
      });

      const parsed = JSON.parse((response.text || "{}").trim());
      return res.json(parsed);
    } catch (error: any) {
      console.error("[Backend] /api/tts/cast error:", error);
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Standard proxy routes
  app.post("/api/generate-content", async (req, res): Promise<any> => {
    try {
      const ai = createGenAiClient();
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const response = await ai.models.generateContent(params);
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/generate-content error:", error);
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/chat-message", async (req, res): Promise<any> => {
    try {
      const ai = createGenAiClient();
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const response = await chat.sendMessage({ message, config: msgConfig });
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/chat-message error:", error);
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) => res.status(404).end());
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
