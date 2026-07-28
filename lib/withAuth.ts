import type { User } from "@supabase/supabase-js";
import { createAnonClient } from "./supabase";
import { jsonWithCors } from "./cors";

export type AuthResult =
  | { user: User; errorResponse: null }
  | { user: null; errorResponse: Response };

/** Extract and validate the Bearer token from the Authorization header. */
export async function withAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return {
      user: null,
      errorResponse: jsonWithCors({ error: "Missing authorization token" }, { status: 401 }),
    };
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      user: null,
      errorResponse: jsonWithCors({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }

  return { user: data.user, errorResponse: null };
}
