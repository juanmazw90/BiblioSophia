import { useState, useEffect, useRef } from "react";
import {
  Youtube,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Clock,
  Zap,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { runPipeline, checkDependencies } from "../services/tauri";
import type { DepsStatus, LogEntry, ProcessStage } from "../types";
import clsx from "clsx";

const STAGE_LABELS: Record<string, string> = {
  fetching_info: "Obteniendo info",
  downloading: "Descargando",
  transcribing: "Transcribiendo",
  summarizing: "Resumiendo",
  saving: "Guardando",
};

const STAGE_COLORS: Record<string, string> = {
  fetching_info: "text-blue-400",
  downloading: "text-yellow-400",
  transcribing: "text-purple-400",
  summarizing: "text-green-400",
  saving: "text-cyan-400",
  error: "text-red-400",
};

function isValidYouTubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[A-Za-z0-9_-]{11}/.test(
    url
  );
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function MainScreen() {
  const {
    url,
    setUrl,
    stage,
    setStage,
    log,
    addLog,
    clearLog,
    setResult,
    setError,
    setActiveTab,
    settings,
    addUsageEntry,
  } = useAppStore();

  const [deps, setDeps] = useState<DepsStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const isProcessing = stage !== "idle" && stage !== "done" && stage !== "error";

  // Check dependencies on mount
  useEffect(() => {
    checkDependencies()
      .then(setDeps)
      .catch(() => setDeps({ ytdlp_version: null, ffmpeg_available: false }))
      .finally(() => setIsChecking(false));
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const handleProcess = async () => {
    if (!url.trim() || isProcessing) return;
    if (!isValidYouTubeUrl(url)) {
      addLog({ stage: "error", message: "URL de YouTube inválida. Verifica el formato." });
      return;
    }
    if (!settings.groqApiKey) {
      addLog({ stage: "error", message: "Falta la API key de Groq. Ve a Ajustes → API Keys." });
      return;
    }
    if (!settings.anthropicApiKey) {
      addLog({ stage: "error", message: "Falta la API key de Anthropic. Ve a Ajustes → API Keys." });
      return;
    }

    clearLog();
    setResult(null);
    setError("");
    setStage("fetching_info");

    const startTime = Date.now();

    await runPipeline(url, settings, {
      onLog: (message, stageStr, percent) => {
        const mapped = (stageStr as ProcessStage) || stage;
        addLog({ stage: mapped, message, percent });
        setStage(mapped);
      },
      onComplete: ({ videoInfo, transcript, summary, savedPath, notionUrl }) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        addLog({
          stage: "done",
          message: `✓ Procesamiento completado en ${elapsed}s`,
          percent: 100,
        });
        setResult({
          video_info: videoInfo,
          transcript,
          summary,
          audio_duration_seconds: videoInfo.duration,
          saved_path: savedPath,
          notion_url: notionUrl,
        });
        setStage("done");

        // Record usage
        addUsageEntry({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          videoTitle: videoInfo.title,
          videoUrl: url,
          transcriptionProvider: "Groq Whisper",
          summaryProvider: settings.summaryModel,
          audioDurationSeconds: videoInfo.duration,
          tokensUsed: summary.total_tokens,
          costUsd: summary.cost_usd,
        });

        setTimeout(() => setActiveTab("result"), 800);
      },
      onError: (message) => {
        addLog({ stage: "error", message: `✗ Error: ${message}` });
        setStage("error");
        setError(message);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isProcessing) handleProcess();
  };

  const canProcess =
    url.trim().length > 0 &&
    !isProcessing &&
    (deps?.ytdlp_version != null);

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Procesar Video</h1>
        <p className="text-gray-400 text-sm mt-1">
          Pega un link de YouTube para transcribirlo y generar un resumen con IA.
        </p>
      </div>

      {/* Dependency warnings */}
      {!isChecking && deps && (
        <div className="mb-4 space-y-2">
          {!deps.ytdlp_version && (
            <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2.5 text-yellow-300 text-sm">
              <AlertTriangle size={15} />
              <span>
                <strong>yt-dlp no encontrado.</strong> Consulta{" "}
                <span className="underline font-mono">SETUP.md</span> para instalarlo.
              </span>
            </div>
          )}
          {!deps.ffmpeg_available && (
            <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2.5 text-yellow-300 text-sm">
              <AlertTriangle size={15} />
              <span>
                <strong>FFmpeg no encontrado.</strong> Necesario para convertir audio.
              </span>
            </div>
          )}
          {deps.ytdlp_version && deps.ffmpeg_available && !isProcessing && log.length === 0 && (
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-2.5 text-green-400 text-sm">
              <CheckCircle2 size={15} />
              <span>yt-dlp {deps.ytdlp_version} · FFmpeg listo</span>
            </div>
          )}
        </div>
      )}

      {/* URL Input */}
      <div className="card mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          URL del Video
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Youtube
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isProcessing}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="btn-primary"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Play size={16} />
                Procesar
              </>
            )}
          </button>
        </div>

        {/* URL validation hint */}
        {url && !isValidYouTubeUrl(url) && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
            <XCircle size={12} />
            URL inválida. Debe ser youtube.com/watch?v=... o youtu.be/...
          </p>
        )}
      </div>

      {/* Processing stages indicator */}
      {(isProcessing || stage === "done" || stage === "error") && (
        <div className="card mb-4">
          <div className="flex items-center justify-between gap-2">
            {["fetching_info", "downloading", "transcribing", "summarizing", "saving"].map(
              (s, i, arr) => {
                const stageIndex = arr.indexOf(stage);
                const thisIndex = i;
                const isDone = stageIndex > thisIndex || stage === "done";
                const isActive = stage === s;
                const isError = stage === "error";

                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className={clsx(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                        isDone && !isError
                          ? "bg-green-600 text-white"
                          : isActive
                          ? "bg-brand-600 text-white ring-2 ring-brand-400 ring-offset-1 ring-offset-surface-800"
                          : "bg-surface-600 text-gray-500"
                      )}
                    >
                      {isDone && !isError ? (
                        <CheckCircle2 size={14} />
                      ) : isActive ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className="text-xs text-gray-500 text-center leading-tight">
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Real-time Log */}
      {log.length > 0 && (
        <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-brand-500" />
            <span className="text-sm font-medium text-gray-300">Log en tiempo real</span>
            {isProcessing && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-brand-400">
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                Procesando...
              </span>
            )}
            {stage === "done" && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 size={12} />
                Completado
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 min-h-0">
            {log.map((entry: LogEntry) => (
              <div
                key={entry.id}
                className={clsx(
                  "log-entry flex items-start gap-3 py-1.5 px-2 rounded",
                  entry.stage === "error" ? "bg-red-950/40" : "hover:bg-surface-700/30"
                )}
              >
                <span className="text-gray-600 flex-shrink-0 select-text">
                  {formatTimestamp(entry.timestamp)}
                </span>
                {entry.stage !== "idle" && entry.stage !== "done" && (
                  <span
                    className={clsx(
                      "flex-shrink-0 font-semibold",
                      STAGE_COLORS[entry.stage] || "text-gray-400"
                    )}
                  >
                    [{STAGE_LABELS[entry.stage] || entry.stage}]
                  </span>
                )}
                <span
                  className={clsx(
                    "flex-1 select-text",
                    entry.stage === "error" ? "text-red-300" : "text-gray-300"
                  )}
                >
                  {entry.message}
                </span>
                {entry.percent !== undefined && entry.percent > 0 && entry.percent < 100 && (
                  <span className="text-gray-500 flex-shrink-0">
                    {entry.percent.toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {log.length === 0 && !isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
          <Clock size={40} className="text-gray-600 mb-3" />
          <p className="text-gray-500 text-sm">El log de procesamiento aparecerá aquí.</p>
          <p className="text-gray-600 text-xs mt-1">
            Pega una URL y presiona Procesar para empezar.
          </p>
        </div>
      )}

      {/* Result quick-action */}
      {stage === "done" && (
        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            onClick={() => setActiveTab("result")}
            className="btn-primary"
          >
            <ExternalLink size={15} />
            Ver resultado
          </button>
        </div>
      )}
    </div>
  );
}
