import { NextRequest, NextResponse } from "next/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export function sameOrigin(request: NextRequest) {
  // Explicit public URL avoids trusting forwarded host headers for our write API.
  const origin = request.headers.get("origin");
  const expected = process.env.AUTH_URL || (process.env.NODE_ENV !== "production" ? request.url : "");
  if (!origin || !expected) return false;
  try { return new URL(origin).origin === new URL(expected).origin; } catch { return false; }
}

export async function readJsonBody(request: NextRequest, limit = 1024 * 1024): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new RangeError("Body too large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
