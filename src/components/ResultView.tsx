import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Copy,
  Check,
  FolderOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Youtube,
  Coins,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { openFolder } from "../services/tauri";
import clsx from "clsx";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="btn-ghost text-xs py-1.5 px-3">
      {copied ? (
        <>
          <Check size={13} className="text-green-400" />
          <span className="text-green-400">Copiado</span>
        </>
      ) : (
        <>
          <Copy size={13} />
          Copiar
        </>
      )}
    </button>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function ResultView() {
  const { currentResult } = useAppStore();
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  if (!currentResult) {
    return (
      <div className="h-full flex items-center justify-center text-center opacity-40">
        <div>
          <Youtube size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Aún no hay resultados.</p>
          <p className="text-gray-600 text-sm mt-1">Procesa un video primero.</p>
        </div>
      </div>
    );
  }

  const { video_info, transcript, summary, saved_path, notion_url } = currentResult;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Video header */}
      <div className="px-6 pt-5 pb-4 border-b border-surface-600 bg-surface-800 flex-shrink-0">
        <div className="flex items-start gap-4">
          {video_info.thumbnail && (
            <img
              src={video_info.thumbnail}
              alt="thumbnail"
              className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white leading-snug truncate">
              {video_info.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <User size={13} />
                {video_info.channel}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} />
                {formatDuration(video_info.duration)}
              </span>
              <span className="flex items-center gap-1.5">
                <Coins size={13} />
                {summary.total_tokens.toLocaleString()} tokens · $
                {summary.cost_usd.toFixed(4)}
              </span>
            </div>
            <a
              href={video_info.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1.5 transition-colors"
            >
              <Youtube size={12} />
              Ver en YouTube
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <CopyButton text={summary.summary} />
          {saved_path && (
            <button
              onClick={() => openFolder(saved_path!.split(/[\\/]/).slice(0, -1).join("/"))}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              <FolderOpen size={13} />
              Abrir carpeta
            </button>
          )}
          {notion_url && (
            <a href={notion_url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1.5 px-3">
              <ExternalLink size={13} />
              Ver en Notion
            </a>
          )}
        </div>

        {/* File path badge */}
        {saved_path && (
          <p className="mt-2 text-xs text-gray-500 font-mono truncate">
            💾 {saved_path}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Summary section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Resumen</h3>
            <CopyButton text={summary.summary} />
          </div>
          <div
            data-selectable
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-semibold
              prose-h2:text-base prose-h3:text-sm
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-li:text-gray-300
              prose-strong:text-gray-100
              prose-blockquote:border-brand-500 prose-blockquote:text-gray-400
              prose-hr:border-surface-600"
          >
            <ReactMarkdown>{summary.summary}</ReactMarkdown>
          </div>
        </div>

        {/* Token usage */}
        <div className="card">
          <h3 className="font-semibold text-white mb-3 text-sm">Uso de API</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Tokens entrada", value: summary.input_tokens.toLocaleString() },
              { label: "Tokens salida", value: summary.output_tokens.toLocaleString() },
              { label: "Total tokens", value: summary.total_tokens.toLocaleString() },
              { label: "Costo estimado", value: `$${summary.cost_usd.toFixed(4)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-700 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white font-mono">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Transcript collapsible */}
        <div className="card">
          <button
            onClick={() => setTranscriptOpen((o) => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="font-semibold text-white">Transcripción completa</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {transcript.split(" ").length.toLocaleString()} palabras ·{" "}
                {transcript.length.toLocaleString()} caracteres
              </p>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <CopyButton text={transcript} />
              {transcriptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          <div
            className={clsx(
              "overflow-hidden transition-all duration-300",
              transcriptOpen ? "mt-4 max-h-[600px]" : "max-h-0"
            )}
          >
            <div className="overflow-y-auto max-h-96">
              <p
                data-selectable
                className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-sans"
              >
                {transcript}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
