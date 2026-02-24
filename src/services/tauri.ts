/**
 * Typed wrappers around Tauri invoke commands.
 * All heavy processing runs in the Rust backend — API keys never touch the renderer.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type {
  VideoInfo,
  SummaryResult,
  DepsStatus,
  ProgressEvent,
  AppSettings,
} from "../types";

// ─── Video Info ───────────────────────────────────────────────────────────────

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("get_video_info", { url });
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadAudio(url: string): Promise<string> {
  return invoke<string>("download_audio", { url });
}

// ─── Transcription ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioPath: string,
  groqApiKey: string,
  language?: string
): Promise<string> {
  return invoke<string>("transcribe_audio", {
    audioPath,
    groqApiKey,
    language: language === "auto" ? null : language,
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function generateSummary(
  transcript: string,
  videoInfo: VideoInfo,
  anthropicApiKey: string,
  model: string,
  customPrompt: string
): Promise<SummaryResult> {
  return invoke<SummaryResult>("generate_summary", {
    transcript,
    videoInfo,
    anthropicApiKey,
    model,
    customPrompt,
  });
}

// ─── Notion ───────────────────────────────────────────────────────────────────

export async function sendToNotion(
  notionApiKey: string,
  parentId: string,
  videoInfo: VideoInfo,
  summary: string,
  transcript: string
): Promise<string> {
  return invoke<string>("send_to_notion", {
    notionApiKey,
    parentId,
    videoInfo,
    summary,
    transcript,
  });
}

// ─── File System ──────────────────────────────────────────────────────────────

export async function saveMarkdown(
  videoInfo: VideoInfo,
  summary: string,
  transcript: string,
  outputDir: string
): Promise<string> {
  return invoke<string>("save_markdown", {
    videoInfo,
    summary,
    transcript,
    outputDir,
  });
}

export async function openFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}

export async function getDefaultOutputDir(): Promise<string> {
  return invoke<string>("get_default_output_dir");
}

// ─── Dependencies Check ───────────────────────────────────────────────────────

export async function checkDependencies(): Promise<DepsStatus> {
  return invoke<DepsStatus>("check_dependencies");
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

export async function onProcessProgress(
  callback: (event: ProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<ProgressEvent>("process-progress", (e) => callback(e.payload));
}

// ─── Full Processing Pipeline ─────────────────────────────────────────────────

export interface PipelineCallbacks {
  onLog: (message: string, stage: string, percent?: number) => void;
  onComplete: (result: {
    videoInfo: VideoInfo;
    transcript: string;
    summary: SummaryResult;
    savedPath?: string;
    notionUrl?: string;
  }) => void;
  onError: (message: string) => void;
}

export async function runPipeline(
  url: string,
  settings: AppSettings,
  callbacks: PipelineCallbacks
): Promise<void> {
  const { onLog, onComplete, onError } = callbacks;

  // Subscribe to Rust progress events
  const unlisten = await onProcessProgress((event) => {
    onLog(event.message, event.stage, event.percent);
  });

  try {
    // Step 1: Fetch video metadata
    onLog("Obteniendo información del video...", "fetching_info");
    const videoInfo = await getVideoInfo(url);
    onLog(`Video: "${videoInfo.title}" (${formatDuration(videoInfo.duration)})`, "fetching_info");

    // Step 2: Download audio
    onLog("Iniciando descarga de audio...", "downloading", 0);
    const audioPath = await downloadAudio(url);
    onLog("Audio descargado correctamente.", "downloading", 100);

    // Step 3: Transcribe
    onLog("Enviando a Groq Whisper para transcripción...", "transcribing");
    const transcript = await transcribeAudio(
      audioPath,
      settings.groqApiKey,
      settings.transcriptionLanguage
    );
    onLog(
      `Transcripción completada: ${transcript.split(" ").length.toLocaleString()} palabras.`,
      "transcribing",
      100
    );

    // Step 4: Summarize
    onLog("Generando resumen con Claude...", "summarizing");
    const summary = await generateSummary(
      transcript,
      videoInfo,
      settings.anthropicApiKey,
      settings.summaryModel,
      settings.customPrompt
    );
    onLog(
      `Resumen generado — ${summary.total_tokens.toLocaleString()} tokens (~$${summary.cost_usd.toFixed(4)}).`,
      "summarizing",
      100
    );

    // Step 5: Save locally
    let savedPath: string | undefined;
    if (settings.saveLocally && settings.outputDir) {
      onLog("Guardando archivo Markdown...", "saving");
      savedPath = await saveMarkdown(
        videoInfo,
        summary.summary,
        transcript,
        settings.outputDir
      );
      onLog(`Guardado en: ${savedPath}`, "saving");
    }

    // Step 6: Send to Notion
    let notionUrl: string | undefined;
    if (settings.sendToNotion) {
      if (!settings.notionApiKey || !settings.notionParentId) {
        onLog(
          "⚠ Notion omitido: falta API key o Database ID en Ajustes.",
          "saving"
        );
      } else {
        onLog("Enviando a Notion...", "saving");
        try {
          notionUrl = await sendToNotion(
            settings.notionApiKey,
            settings.notionParentId,
            videoInfo,
            summary.summary,
            transcript
          );
          onLog(`✓ Página de Notion creada: ${notionUrl}`, "saving");
        } catch (notionErr: unknown) {
          const msg =
            notionErr instanceof Error ? notionErr.message : String(notionErr);
          onLog(`⚠ Error enviando a Notion: ${msg}`, "saving");
        }
      }
    }

    onComplete({ videoInfo, transcript, summary, savedPath, notionUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    onError(msg);
  } finally {
    unlisten();
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
