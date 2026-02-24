// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface VideoInfo {
  title: string;
  channel: string;
  duration: number; // seconds
  url: string;
  thumbnail?: string;
  description?: string;
  upload_date?: string; // "YYYY-MM-DD"
}

export interface SummaryResult {
  summary: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface ProcessResult {
  video_info: VideoInfo;
  transcript: string;
  summary: SummaryResult;
  audio_duration_seconds: number;
  saved_path?: string;
  notion_url?: string;
}

export interface DepsStatus {
  ytdlp_version: string | null;
  ffmpeg_available: boolean;
}

// ─── Processing State ─────────────────────────────────────────────────────────

export type ProcessStage =
  | "idle"
  | "fetching_info"
  | "downloading"
  | "transcribing"
  | "summarizing"
  | "saving"
  | "done"
  | "error";

export interface LogEntry {
  id: string;
  timestamp: Date;
  stage: ProcessStage;
  message: string;
  percent?: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type TranscriptionProvider = "groq";
export type SummaryModel =
  | "claude-sonnet-4-6"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5"
  | "claude-opus-4-6";

export interface AppSettings {
  // API Keys
  groqApiKey: string;
  anthropicApiKey: string;
  notionApiKey: string;
  notionParentId: string;

  // Processing
  summaryModel: SummaryModel;
  transcriptionLanguage: string; // "auto" | "es" | "en" | etc.
  customPrompt: string;

  // Storage
  saveLocally: boolean;
  sendToNotion: boolean;
  outputDir: string;
}

export const DEFAULT_SYSTEM_PROMPT = `Eres un asistente experto en análisis de contenido. Tu tarea es crear un resumen ejecutivo estructurado del siguiente video de YouTube.

**Video:** {{video_title}}
**Canal:** {{channel}}
**Duración:** {{duration}}

Genera el resumen con este formato exacto en Español:

## 🎯 Idea Central
Una sola frase que capture la esencia del video.

## 📌 Puntos Clave
• [Punto 1 — máximo 2 líneas]
• [Punto 2 — máximo 2 líneas]
• [Punto 3 — máximo 2 líneas]
• [Punto 4 — máximo 2 líneas]
• [Punto 5 — máximo 2 líneas]

## 💡 Ideas Accionables
• [Acción concreta que el espectador puede aplicar hoy]
• [Segunda acción práctica]
• [Tercera acción práctica]

## 🔑 Cita Destacada
> "Una cita textual memorable del video"

## 📊 Contextos de Aplicación
Describe en 2-3 líneas quién se beneficia más de este contenido y en qué situaciones aplicarlo.

## 🏷 Categoría
Escoge UNA categoría de esta lista (escribe solo el nombre, sin explicación): Tutorial, Entretenimiento, Educativo, Música, Deportes, Tecnología, Noticias, Salud, Otros

---
Usa el siguiente contenido como base:

{{transcript}}`;

export const DEFAULT_SETTINGS: AppSettings = {
  groqApiKey: "",
  anthropicApiKey: "",
  notionApiKey: "",
  notionParentId: "",
  summaryModel: "claude-sonnet-4-6",
  transcriptionLanguage: "auto",
  customPrompt: DEFAULT_SYSTEM_PROMPT,
  saveLocally: true,
  sendToNotion: false,
  outputDir: "",
};

// ─── Usage / Dashboard ────────────────────────────────────────────────────────

export interface UsageEntry {
  id: string;
  timestamp: string; // ISO string
  videoTitle: string;
  videoUrl: string;
  transcriptionProvider: string;
  summaryProvider: string;
  audioDurationSeconds: number;
  tokensUsed: number;
  costUsd: number;
}

export interface UsageSummary {
  totalCost: number;
  totalTokens: number;
  totalMinutes: number;
  totalVideos: number;
  byProvider: Record<string, { cost: number; tokens: number }>;
  entries: UsageEntry[];
}

// ─── Progress Event (from Rust) ───────────────────────────────────────────────

export interface ProgressEvent {
  stage: string;
  message: string;
  percent?: number;
}
