import { jsonWithCors, optionsResponse } from "@/lib/cors";
import { createAnonClient } from "@/lib/supabase";
import type { RefreshRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { refreshToken } = (body ?? {}) as Partial<RefreshRequest>;

  if (!refreshToken || typeof refreshToken !== "string") {
    return jsonWithCors({ error: "refreshToken is required" }, { status: 400 });
  }

  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      return jsonWithCors(
        { error: error?.message ?? "Token refresh failed" },
        { status: 401 }
      );
    }

    return jsonWithCors({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[auth/refresh]", message);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}
