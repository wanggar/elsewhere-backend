export const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function jsonWithCors(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
