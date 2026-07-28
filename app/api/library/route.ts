import { jsonWithCors, optionsResponse } from "@/lib/cors";
import { withAuth } from "@/lib/withAuth";
import { createAdminClient } from "@/lib/supabase";
import { CURATOR_MODES } from "@/lib/types";
import type {
  CuratorMode,
  LibraryResponse,
  LibrarySoundResponse,
  SaveSoundRequest,
  SaveSoundResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const SIGNED_URL_EXPIRES_IN = 3600; // 1 hour

export async function OPTIONS() {
  return optionsResponse();
}

// ── GET /api/library ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await withAuth(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const admin = createAdminClient();

    const { data: rows, error } = await admin
      .from("sounds")
      .select("id, mode, title, subtitle, audio_storage_path, created_at")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[library/GET]", error.message);
      return jsonWithCors({ error: "Failed to fetch library" }, { status: 500 });
    }

    // Generate signed URLs for each sound
    const sounds: LibrarySoundResponse[] = await Promise.all(
      (rows ?? []).map(async (row) => {
        let audioUrl = "";
        if (row.audio_storage_path) {
          const { data: signed } = await admin.storage
            .from("sounds")
            .createSignedUrl(row.audio_storage_path, SIGNED_URL_EXPIRES_IN);
          audioUrl = signed?.signedUrl ?? "";
        }
        return {
          id: row.id,
          mode: row.mode as CuratorMode,
          title: row.title,
          subtitle: row.subtitle,
          audioUrl,
          createdAt: row.created_at,
        };
      })
    );

    const response: LibraryResponse = { sounds };
    return jsonWithCors(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[library/GET]", message);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

// ── POST /api/library ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await withAuth(request);
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mode, title, subtitle, audioBase64, generationPrompt } =
    (body ?? {}) as Partial<SaveSoundRequest>;

  if (!mode || !(CURATOR_MODES as readonly string[]).includes(mode)) {
    return jsonWithCors({ error: "Invalid mode" }, { status: 400 });
  }
  if (!title || typeof title !== "string") {
    return jsonWithCors({ error: "title is required" }, { status: 400 });
  }
  if (!subtitle || typeof subtitle !== "string") {
    return jsonWithCors({ error: "subtitle is required" }, { status: 400 });
  }
  if (!audioBase64 || typeof audioBase64 !== "string") {
    return jsonWithCors({ error: "audioBase64 is required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const soundId = crypto.randomUUID();
    const storagePath = `${auth.user.id}/${soundId}.mp3`;

    // Decode base64 → buffer and upload to Supabase Storage
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const { error: uploadError } = await admin.storage
      .from("sounds")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[library/POST] storage upload:", uploadError.message);
      return jsonWithCors({ error: "Failed to upload audio" }, { status: 502 });
    }

    // Insert the sound row
    const { data: row, error: insertError } = await admin
      .from("sounds")
      .insert({
        id: soundId,
        user_id: auth.user.id,
        mode,
        title,
        subtitle,
        audio_storage_path: storagePath,
        generation_prompt: generationPrompt ?? null,
      })
      .select("id, mode, title, subtitle, audio_storage_path, created_at")
      .single();

    if (insertError || !row) {
      console.error("[library/POST] insert:", insertError?.message);
      return jsonWithCors({ error: "Failed to save sound" }, { status: 500 });
    }

    // Generate signed URL for immediate playback
    const { data: signed } = await admin.storage
      .from("sounds")
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);

    const sound: LibrarySoundResponse = {
      id: row.id,
      mode: row.mode as CuratorMode,
      title: row.title,
      subtitle: row.subtitle,
      audioUrl: signed?.signedUrl ?? "",
      createdAt: row.created_at,
    };

    const response: SaveSoundResponse = { sound };
    return jsonWithCors(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[library/POST]", message);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}
