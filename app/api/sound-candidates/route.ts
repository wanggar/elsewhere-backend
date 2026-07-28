import { randomUUID } from "crypto";
import { jsonWithCors, optionsResponse } from "@/lib/cors";
import { extractSoundscape } from "@/lib/extractSoundscape";
import { generateSoundEffectBase64 } from "@/lib/generateSoundEffect";
import { withAuth } from "@/lib/withAuth";
import {
  CURATOR_MODES,
  type CuratorMode,
  type SoundCandidatesRequest,
  type SoundCandidatesResponse,
  type TranscriptMessage,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function OPTIONS() {
  return optionsResponse();
}

function isCuratorMode(value: unknown): value is CuratorMode {
  return (
    typeof value === "string" &&
    (CURATOR_MODES as readonly string[]).includes(value)
  );
}

function parseRequest(body: unknown): SoundCandidatesRequest | null {
  if (!body || typeof body !== "object") return null;

  const { mode, messages } = body as Record<string, unknown>;
  if (!isCuratorMode(mode)) return null;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const parsedMessages: TranscriptMessage[] = [];
  for (const item of messages) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "agent") return null;
    if (typeof content !== "string" || content.trim().length === 0) return null;
    parsedMessages.push({ role, content: content.trim() });
  }

  return { mode, messages: parsedMessages };
}

export async function POST(request: Request) {
  const auth = await withAuth(request);
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseRequest(body);
  if (!parsed) {
    return jsonWithCors(
      {
        error:
          'Request must include mode (sleep|focus|relax|uplift|move) and a non-empty messages array of { role: "user"|"agent", content: string }',
      },
      { status: 400 }
    );
  }

  try {
    const extraction = await extractSoundscape(parsed.mode, parsed.messages);

    const audioResults = await Promise.all(
      extraction.candidates.map((candidate) =>
        generateSoundEffectBase64(candidate.prompt)
      )
    );

    const response: SoundCandidatesResponse = {
      headerTitle: extraction.headerTitle,
      checklist: extraction.checklist,
      candidates: extraction.candidates.map((candidate, index) => ({
        id: randomUUID(),
        title: candidate.title,
        subtitle: candidate.subtitle,
        prompt: candidate.prompt,
        durationSeconds: audioResults[index].durationSeconds,
        audioBase64: audioResults[index].audioBase64,
        mimeType: "audio/mpeg",
      })),
    };

    return jsonWithCors(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sound candidate generation failed";
    console.error("[sound-candidates]", message);

    const status =
      message.includes("not configured") || message.includes("API key")
        ? 500
        : 502;

    return jsonWithCors({ error: message }, { status });
  }
}
