import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;

const CACHE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const MOCK_REPLY =
  "Perch mobile backend is connected. Add NVIDIA_NIM_API_KEY to enable live AI.";

const SYSTEM_PROMPT = `You are Perch Terminal, a Pakistan-market assistant.
Provide general market explanation only.
Do not provide personalized investment advice.
Do not make buy/sell recommendations.
Keep answers concise for mobile.`;

const NIM_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/** Default model for NVIDIA API catalog; override with NVIDIA_NIM_MODEL. */
const DEFAULT_NIM_MODEL = "meta/llama-3.1-8b-instruct";

type ChatSuccessBody = {
  reply: string;
  provider: "nvidia-nim" | "mock";
};

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CACHE_HEADERS });
}

export async function POST(request: Request) {
  try {
    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const messageRaw =
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : "";

    const message = messageRaw.trim();
    if (!message) {
      return jsonResponse({ error: "Missing or empty message." }, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(
        { error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters.` },
        400
      );
    }

    const apiKey = process.env.NVIDIA_NIM_API_KEY?.trim();
    if (!apiKey) {
      const body: ChatSuccessBody = { reply: MOCK_REPLY, provider: "mock" };
      return jsonResponse(body, 200);
    }

    const model =
      process.env.NVIDIA_NIM_MODEL?.trim() || DEFAULT_NIM_MODEL;

    const nimResponse = await fetch(NIM_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 512,
        temperature: 0.4,
      }),
    });

    if (!nimResponse.ok) {
      console.error("mobile chat: NIM error", nimResponse.status);
      return jsonResponse({ error: "AI service unavailable." }, 502);
    }

    let nimJson: unknown;
    try {
      nimJson = await nimResponse.json();
    } catch {
      console.error("mobile chat: NIM response not JSON");
      return jsonResponse({ error: "AI service unavailable." }, 502);
    }

    const choices =
      nimJson &&
      typeof nimJson === "object" &&
      "choices" in nimJson &&
      Array.isArray((nimJson as { choices: unknown }).choices)
        ? (nimJson as { choices: unknown[] }).choices
        : [];

    const first = choices[0];
    const content =
      first &&
      typeof first === "object" &&
      first !== null &&
      "message" in first &&
      typeof (first as { message: unknown }).message === "object" &&
      (first as { message: { content?: unknown } }).message !== null &&
      typeof (first as { message: { content?: unknown } }).message.content ===
        "string"
        ? (first as { message: { content: string } }).message.content.trim()
        : "";

    if (!content) {
      console.error("mobile chat: empty NIM completion");
      return jsonResponse({ error: "AI service unavailable." }, 502);
    }

    const body: ChatSuccessBody = {
      reply: content,
      provider: "nvidia-nim",
    };
    return jsonResponse(body, 200);
  } catch {
    console.error("mobile chat: unexpected failure");
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
}
