import { jsonWithCors, optionsResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return jsonWithCors({ ok: true });
}
