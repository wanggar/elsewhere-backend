import { jsonWithCors, optionsResponse } from "@/lib/cors";
import { createAnonClient, createAdminClient } from "@/lib/supabase";
import type { AppleSignInRequest, AuthResponse } from "@/lib/types";

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

  const { identityToken, fullName } = (body ?? {}) as Partial<AppleSignInRequest>;

  if (!identityToken || typeof identityToken !== "string") {
    return jsonWithCors({ error: "identityToken is required" }, { status: 400 });
  }

  try {
    const supabase = createAnonClient();

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });

    if (error || !data.session || !data.user) {
      console.error("[auth/apple] signInWithIdToken error:", error?.message);
      return jsonWithCors(
        { error: error?.message ?? "Apple sign-in failed" },
        { status: 401 }
      );
    }

    // Build display name from Apple's fullName (only provided on first sign-in)
    const displayName =
      fullName?.givenName || fullName?.familyName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ")
        : null;

    // Upsert the profile row using the admin client
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .upsert(
        {
          id: data.user.id,
          ...(displayName ? { display_name: displayName } : {}),
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: false }
      );

    // Fetch stored display name (may already exist from a previous sign-in)
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", data.user.id)
      .single();

    const response: AuthResponse = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        displayName: profile?.display_name ?? displayName,
      },
    };

    return jsonWithCors(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[auth/apple]", message);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}
