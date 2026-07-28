export const CURATOR_MODES = [
  "sleep",
  "focus",
  "relax",
  "uplift",
  "move",
] as const;

export type CuratorMode = (typeof CURATOR_MODES)[number];

export type TranscriptRole = "user" | "agent";

export interface TranscriptMessage {
  role: TranscriptRole;
  content: string;
}

export interface SoundCandidatesRequest {
  mode: CuratorMode;
  messages: TranscriptMessage[];
}

export interface ExtractedCandidate {
  title: string;
  subtitle: string;
  prompt: string;
}

export interface SoundscapeExtraction {
  headerTitle: string;
  checklist: string[];
  candidates: ExtractedCandidate[];
}

export interface SoundCandidateResponse {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  durationSeconds: number;
  audioBase64: string;
  mimeType: "audio/mpeg";
}

export interface SoundCandidatesResponse {
  headerTitle: string;
  checklist: string[];
  candidates: SoundCandidateResponse[];
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AppleSignInRequest {
  identityToken: string;
  fullName?: {
    givenName?: string;
    familyName?: string;
  };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    displayName: string | null;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

// ── Library ───────────────────────────────────────────────────────────────────

export interface LibrarySoundResponse {
  id: string;
  mode: CuratorMode;
  title: string;
  subtitle: string;
  audioUrl: string;
  createdAt: string;
}

export interface LibraryResponse {
  sounds: LibrarySoundResponse[];
}

export interface SaveSoundRequest {
  mode: CuratorMode;
  title: string;
  subtitle: string;
  audioBase64: string;
  generationPrompt?: string;
}

export interface SaveSoundResponse {
  sound: LibrarySoundResponse;
}
