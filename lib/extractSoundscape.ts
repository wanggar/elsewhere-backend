import OpenAI from "openai";
import type {
  CuratorMode,
  SoundscapeExtraction,
  TranscriptMessage,
} from "./types";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headerTitle: {
      type: "string",
      description:
        "Short uppercase label for the candidates screen, e.g. YOUR WINTER, THREE WAYS",
    },
    checklist: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: { type: "string" },
      description:
        "Short poetic fragments shown while generating, drawn from the conversation",
    },
    candidates: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "Short lowercase place/mood title, e.g. the living room",
          },
          subtitle: {
            type: "string",
            description:
              "Comma-separated layer hints, e.g. heater settling, the page turning",
          },
          prompt: {
            type: "string",
            maxLength: 350,
            description:
              "ElevenLabs ambience loop prompt. Physical sounds only — no emotions or visuals. Under 350 characters.",
          },
        },
        required: ["title", "subtitle", "prompt"],
      },
    },
  },
  required: ["headerTitle", "checklist", "candidates"],
} as const;

function formatTranscript(messages: TranscriptMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Curator"}: ${m.content}`)
    .join("\n");
}

export async function extractSoundscape(
  mode: CuratorMode,
  messages: TranscriptMessage[]
): Promise<SoundscapeExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey });
  const transcript = formatTranscript(messages);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini-2026-03-17",
    temperature: 0.7,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "soundscape_extraction",
        strict: true,
        schema: EXTRACTION_SCHEMA,
      },
    },
    messages: [
      {
        role: "system",
        content: `You are a sound designer for Elsewhere, an AI sound companion for emotional regulation.
Given a conversation between a user and a curator, extract exactly 3 distinct ambient soundscape candidates for mode "${mode}".

Rules:
- Candidates must feel personal to what the user shared — identity, place, season, sensory details.
- Titles are short and lowercase (e.g. "the living room", "just the heater").
- Subtitles list 2–4 gentle layers separated by commas.
- Prompts describe PHYSICAL SOUNDS ONLY — no emotions, no visuals, no narrative. Use audio terminology: ambience, loop, drone, Foley, texture, room tone.
- Structure each prompt as layered Foley in sequence: primary sound → secondary texture → optional distant detail. Example: "Soft rain falling on glass. Distant low hum of ventilation. Occasional creak of wood settling. Seamless ambient loop."
- Prompts must be under 350 characters — specific and concrete beats long and descriptive.
- No music unless the user explicitly asked for it.
- Vary the three candidates: one fuller scene, one alternate angle, one stripped-down version.
- headerTitle is SHORT UPPERCASE, ending or implying "THREE WAYS" when natural.
- checklist: 3–4 short poetic fragments drawn from the conversation.`,
      },
      {
        role: "user",
        content: `Mode: ${mode}\n\nConversation:\n${transcript}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("GPT returned an empty soundscape extraction");
  }

  const parsed = JSON.parse(content) as SoundscapeExtraction;

  if (!Array.isArray(parsed.candidates) || parsed.candidates.length !== 3) {
    throw new Error("GPT did not return exactly 3 candidates");
  }

  return parsed;
}
