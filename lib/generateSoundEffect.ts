import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const DURATION_SECONDS = 15;

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function generateSoundEffectBase64(
  prompt: string
): Promise<{ audioBase64: string; durationSeconds: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const client = new ElevenLabsClient({ apiKey });

  const stream = await client.textToSoundEffects.convert({
    text: prompt,
    modelId: "eleven_text_to_sound_v2",
    loop: true,
    durationSeconds: DURATION_SECONDS,
    promptInfluence: 0.5,
    outputFormat: "mp3_44100_128",
  });

  const buffer = await streamToBuffer(stream);

  return {
    audioBase64: buffer.toString("base64"),
    durationSeconds: DURATION_SECONDS,
  };
}

export { DURATION_SECONDS };
