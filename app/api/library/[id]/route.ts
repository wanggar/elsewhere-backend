import { jsonWithCors, optionsResponse } from "@/lib/cors";
import { withAuth } from "@/lib/withAuth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

// ── DELETE /api/library/:id ───────────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;

  if (!id) {
    return jsonWithCors({ error: "Sound ID is required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Fetch the row first to confirm ownership
    const { data: row, error: fetchError } = await admin
      .from("sounds")
      .select("id, user_id, audio_storage_path")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !row) {
      return jsonWithCors({ error: "Sound not found" }, { status: 404 });
    }

    if (row.user_id !== auth.user.id) {
      return jsonWithCors({ error: "Forbidden" }, { status: 403 });
    }

    // Soft-delete: set deleted_at
    const { error: updateError } = await admin
      .from("sounds")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("[library/DELETE]", updateError.message);
      return jsonWithCors({ error: "Failed to delete sound" }, { status: 500 });
    }

    return jsonWithCors({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[library/DELETE]", message);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}
