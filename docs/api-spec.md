# Elsewhere Backend — API Specification

**Base URL (local):** `http://127.0.0.1:3000`  
**Base URL (production):** *(your Vercel deployment URL)*  
**Content-Type:** `application/json` on all requests with a body  
**CORS:** All origins allowed (`*`)

---

## Authentication

Protected endpoints require a Supabase JWT passed as a Bearer token:

```
Authorization: Bearer <accessToken>
```

Tokens are obtained from `POST /api/auth/apple` and refreshed via `POST /api/auth/refresh`. Tokens expire — always handle `401` responses and refresh proactively.

---

## Endpoints

### `GET /api/health`

Health check. No auth required.

**Response `200`**
```json
{ "ok": true }
```

---

### `POST /api/auth/apple`

Authenticate a user with Apple Sign In. No auth required.

**Request body**
```json
{
  "identityToken": "string",      // required — JWT from Apple Sign In
  "fullName": {                   // optional — only sent by Apple on first sign-in
    "givenName": "string",
    "familyName": "string"
  }
}
```

**Response `200`**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {
    "id": "uuid",
    "displayName": "string | null"
  }
}
```

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "identityToken is required" }` | Missing token |
| `401` | `{ "error": "Apple sign-in failed" }` | Apple token invalid/expired |
| `500` | `{ "error": "..." }` | Server error |

**Notes**
- `displayName` is only available on the very first Apple sign-in (Apple only sends `fullName` once). On subsequent sign-ins it returns whatever was stored from the first time, or `null`.
- Store both `accessToken` and `refreshToken` securely on the client (Keychain).

---

### `POST /api/auth/refresh`

Exchange a refresh token for a new access + refresh token pair. No auth required.

**Request body**
```json
{
  "refreshToken": "string"   // required
}
```

**Response `200`**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "refreshToken is required" }` | Missing field |
| `401` | `{ "error": "Token refresh failed" }` | Token expired or invalid |
| `500` | `{ "error": "..." }` | Server error |

**Notes**
- Refresh tokens are rotated on every use — always store the new `refreshToken` returned.
- Call this when a protected endpoint returns `401`.

---

### `POST /api/sound-candidates`

Generate 3 ambient soundscape candidates from a conversation transcript. **Auth required.**

> ⚠️ This endpoint calls GPT + ElevenLabs in sequence and typically takes **10–30 seconds**. Set your client timeout to at least 60s.

**Request body**
```json
{
  "mode": "sleep | focus | relax | uplift | move",   // required
  "messages": [                                        // required, non-empty array
    { "role": "user | agent", "content": "string" }
  ]
}
```

**Response `200`**
```json
{
  "headerTitle": "string",        // short uppercase label, e.g. "WINTER, THREE WAYS"
  "checklist": ["string"],        // 3–4 short poetic fragments from the conversation
  "candidates": [
    {
      "id": "uuid",
      "title": "string",          // short lowercase, e.g. "the living room"
      "subtitle": "string",       // comma-separated layer hints, e.g. "heater settling, page turns"
      "prompt": "string",         // the ElevenLabs prompt used (useful for display/debug)
      "durationSeconds": 22,      // always 22
      "audioBase64": "string",    // base64-encoded MP3 (~344KB each)
      "mimeType": "audio/mpeg"
    }
    // ... 3 total
  ]
}
```

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "..." }` | Invalid `mode` or malformed `messages` |
| `401` | `{ "error": "Missing authorization token" }` | No Bearer token |
| `401` | `{ "error": "Invalid or expired token" }` | Bad/expired token |
| `500` | `{ "error": "..." }` | Missing API keys on server |
| `502` | `{ "error": "..." }` | GPT or ElevenLabs call failed |

**Notes**
- `audioBase64` decodes to an MP3 file. Play it directly with `AVPlayer` by writing to a temp file or using a data URL.
- All 3 candidates are generated in parallel — total time is dominated by the slowest ElevenLabs call.
- `checklist` is intended to display as a "generating…" animation while the user waits.
- If you want to save a candidate to the library later, hold onto `audioBase64`, `title`, `subtitle`, `mode`, and `prompt`.

---

### `GET /api/library`

Fetch the authenticated user's saved sounds. **Auth required.**

**Response `200`**
```json
{
  "sounds": [
    {
      "id": "uuid",
      "mode": "sleep | focus | relax | uplift | move",
      "title": "string",
      "subtitle": "string",
      "audioUrl": "string",      // signed Supabase Storage URL (valid for 1 hour)
      "createdAt": "ISO 8601 timestamp"
    }
  ]
}
```

Sorted newest first. Returns an empty array `{ "sounds": [] }` if none saved.

**Error responses**

| Status | Body | When |
|---|---|---|
| `401` | `{ "error": "Missing authorization token" }` | No Bearer token |
| `401` | `{ "error": "Invalid or expired token" }` | Bad/expired token |
| `500` | `{ "error": "Failed to fetch library" }` | DB error |

**Notes**
- `audioUrl` is a **signed URL** that expires after **1 hour**. Don't cache it permanently — re-fetch the library to get a fresh URL when needed, or request playback close to the time of fetching.
- Soft-deleted sounds are never returned.

---

### `POST /api/library`

Save a generated sound to the user's library. **Auth required.**

**Request body**
```json
{
  "mode": "sleep | focus | relax | uplift | move",   // required
  "title": "string",                                  // required
  "subtitle": "string",                               // required
  "audioBase64": "string",                            // required — base64 MP3 from /api/sound-candidates
  "generationPrompt": "string"                        // optional — the ElevenLabs prompt
}
```

**Response `201`**
```json
{
  "sound": {
    "id": "uuid",
    "mode": "string",
    "title": "string",
    "subtitle": "string",
    "audioUrl": "string",       // signed URL, valid 1 hour
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "Invalid mode" }` | Unrecognized mode value |
| `400` | `{ "error": "title is required" }` | Missing field |
| `400` | `{ "error": "subtitle is required" }` | Missing field |
| `400` | `{ "error": "audioBase64 is required" }` | Missing field |
| `401` | `{ "error": "..." }` | Auth failure |
| `502` | `{ "error": "Failed to upload audio" }` | Storage upload failed |
| `500` | `{ "error": "Failed to save sound" }` | DB insert failed |

**Notes**
- This uploads the raw MP3 to cloud storage — `audioBase64` must be a complete, valid base64 MP3 string (exactly what `/api/sound-candidates` returns in `audioBase64`).
- The returned `audioUrl` is immediately playable.

---

### `DELETE /api/library/:id`

Soft-delete a saved sound. **Auth required.**

**URL parameter:** `id` — the UUID of the sound to delete

**Response `200`**
```json
{ "success": true }
```

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "Sound ID is required" }` | Missing `:id` param |
| `401` | `{ "error": "..." }` | Auth failure |
| `403` | `{ "error": "Forbidden" }` | Sound belongs to a different user |
| `404` | `{ "error": "Sound not found" }` | ID doesn't exist or already deleted |
| `500` | `{ "error": "Failed to delete sound" }` | DB error |

**Notes**
- Deletion is a **soft delete** — the record is retained in the database with a `deleted_at` timestamp. The sound will never appear in `GET /api/library` again.
- The MP3 file in storage is not removed (retained for potential future features).

---

## Type Reference

### `CuratorMode`
```
"sleep" | "focus" | "relax" | "uplift" | "move"
```

### `TranscriptMessage`
```json
{ "role": "user" | "agent", "content": "string" }
```

### Error shape (all errors)
```json
{ "error": "string" }
```

---

## Integration Patterns

### Typical happy-path flow

1. Apple Sign In → `POST /api/auth/apple` → store tokens in Keychain
2. On conversation end → `POST /api/sound-candidates` → show checklist animation while waiting → present 3 candidates
3. User picks one → `POST /api/library` with the chosen candidate's data
4. Library screen → `GET /api/library` → render list with signed URLs
5. User deletes a sound → `DELETE /api/library/:id`

### Token refresh pattern

- On any `401` from a protected endpoint, call `POST /api/auth/refresh` with the stored `refreshToken`
- Update stored tokens with the response
- Retry the original request once with the new `accessToken`
- If refresh also returns `401`, the session is expired — send the user back to Apple Sign In

### Audio playback from `sound-candidates`

- Decode `audioBase64` to raw bytes (`Data(base64Encoded:)` in Swift)
- Write to a temp `.mp3` file in the app's cache directory
- Load with `AVAudioPlayer` or `AVPlayer`
- The audio is a **seamless 22-second loop** — set `numberOfLoops = -1` to loop indefinitely
