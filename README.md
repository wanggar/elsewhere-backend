# Elsewhere backend

Next.js API for post-conversation soundscape candidates. No database.

## Setup

```bash
cp .env.example .env.local
# add OPENAI_API_KEY and ELEVENLABS_API_KEY
npm run dev
```

## Endpoints

- `GET /api/health` → `{ ok: true }`
- `POST /api/sound-candidates` → GPT extract 3 prompts → ElevenLabs SFX → JSON with `audioBase64`

### Example

```bash
curl -s http://127.0.0.1:3000/api/health

curl -s http://127.0.0.1:3000/api/sound-candidates \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "relax",
    "messages": [
      { "role": "user", "content": "Long day. Want a quiet winter living room." },
      { "role": "agent", "content": "Heater settling, soft page turns?" }
    ]
  }'
```

iOS Simulator points at `http://127.0.0.1:3000`.
