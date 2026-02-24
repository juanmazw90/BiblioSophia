import { useState } from "react";
import {
  Key,
  Save,
  Eye,
  EyeOff,
  FolderOpen,
  RotateCcw,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { DEFAULT_SYSTEM_PROMPT, SummaryModel } from "../types";
import { open } from "@tauri-apps/plugin-dialog";
import { getDefaultOutputDir } from "../services/tauri";
import clsx from "clsx";

function ApiKeyField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field pl-9 pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {value && (
        <p className="mt-1 text-xs text-green-500 flex items-center gap-1">
          <CheckCircle2 size={11} />
          API key configurada
        </p>
      )}
      {hint && !value && (
        <p className="mt-1 text-xs text-gray-600">{hint}</p>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
  );
}

const MODEL_OPTIONS: { value: SummaryModel; label: string; desc: string; badge?: string }[] = [
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    desc: "Equilibrio perfecto calidad/costo. Recomendado.",
    badge: "Recomendado",
  },
  {
    value: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    desc: "Más rápido y económico. Buena calidad.",
  },
  {
    value: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    desc: "Versión anterior de Sonnet.",
  },
  {
    value: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    desc: "Máxima calidad. Más lento y costoso.",
  },
];

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detectar" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

export default function SettingsPanel() {
  const { settings, setSettings, saveSettings } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePickOutputDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setSettings({ outputDir: selected });
    }
  };

  const handleDefaultDir = async () => {
    const dir = await getDefaultOutputDir();
    setSettings({ outputDir: dir });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-surface-600 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Ajustes</h1>
          <p className="text-gray-400 text-sm mt-1">
            API keys, modelos y preferencias de exportación.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={15} className="text-green-400" />
          ) : (
            <Save size={15} />
          )}
          {saved ? "Guardado" : "Guardar cambios"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── API Keys ─────────────────────────────────────────────────────── */}
        <section className="card">
          <SectionHeader
            title="API Keys"
            description="Las claves se guardan cifradas en el almacén local de la app."
          />
          <div className="space-y-4">
            <ApiKeyField
              label="Groq API Key (Transcripción)"
              value={settings.groqApiKey}
              onChange={(v) => setSettings({ groqApiKey: v })}
              placeholder="gsk_..."
              hint="Obtén tu key gratis en console.groq.com"
            />
            <ApiKeyField
              label="Anthropic API Key (Resúmenes)"
              value={settings.anthropicApiKey}
              onChange={(v) => setSettings({ anthropicApiKey: v })}
              placeholder="sk-ant-..."
              hint="Obtén tu key en console.anthropic.com"
            />
            <div className="pt-2 border-t border-surface-600">
              <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                Notion (Opcional)
              </p>
              <ApiKeyField
                label="Notion API Key"
                value={settings.notionApiKey}
                onChange={(v) => setSettings({ notionApiKey: v })}
                placeholder="secret_..."
                hint="Crea una integración en notion.so/my-integrations"
              />
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Database ID
                </label>
                <input
                  type="text"
                  value={settings.notionParentId}
                  onChange={(e) => setSettings({ notionParentId: e.target.value })}
                  placeholder="1f4248f7ace6800587d8f76c9eef9c43"
                  className="input-field font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-600">
                  El ID es la parte de la URL antes del "?v=": notion.so/<strong>ID</strong>?v=...
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Modelo de IA ──────────────────────────────────────────────────── */}
        <section className="card">
          <SectionHeader
            title="Modelo de IA para Resúmenes"
            description="Todos usan la API de Anthropic. Los precios son por millón de tokens."
          />
          <div className="space-y-2">
            {MODEL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={clsx(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  settings.summaryModel === opt.value
                    ? "border-brand-500 bg-brand-900/20"
                    : "border-surface-600 hover:border-surface-500"
                )}
              >
                <input
                  type="radio"
                  name="model"
                  value={opt.value}
                  checked={settings.summaryModel === opt.value}
                  onChange={() => setSettings({ summaryModel: opt.value })}
                  className="mt-0.5 accent-red-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{opt.label}</span>
                    {opt.badge && (
                      <span className="text-xs bg-brand-600 text-white px-1.5 py-0.5 rounded font-medium">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── Transcripción ─────────────────────────────────────────────────── */}
        <section className="card">
          <SectionHeader
            title="Transcripción"
            description="Usando Groq Whisper-large-v3 — el más rápido y preciso."
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Idioma del audio
            </label>
            <select
              value={settings.transcriptionLanguage}
              onChange={(e) => setSettings({ transcriptionLanguage: e.target.value })}
              className="input-field"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-700">
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-600">
              "Auto-detectar" funciona bien en la mayoría de los casos.
            </p>
          </div>
        </section>

        {/* ── Exportación ──────────────────────────────────────────────────── */}
        <section className="card">
          <SectionHeader
            title="Destinos de Guardado"
          />
          <div className="space-y-4">
            {/* Save locally toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-200">Guardar localmente (.md)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Crea un archivo Markdown por video procesado.
                </p>
              </div>
              <button
                onClick={() => setSettings({ saveLocally: !settings.saveLocally })}
                className={clsx(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  settings.saveLocally ? "bg-brand-600" : "bg-surface-600"
                )}
              >
                <span
                  className={clsx(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    settings.saveLocally ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </label>

            {/* Output directory */}
            {settings.saveLocally && (
              <div className="pl-0">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Carpeta de destino
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.outputDir}
                    onChange={(e) => setSettings({ outputDir: e.target.value })}
                    placeholder="C:\Users\...\BiblioSophia"
                    className="input-field font-mono text-sm text-xs"
                    readOnly
                  />
                  <button onClick={handlePickOutputDir} className="btn-ghost flex-shrink-0">
                    <FolderOpen size={15} />
                  </button>
                </div>
                {!settings.outputDir && (
                  <button
                    onClick={handleDefaultDir}
                    className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Usar carpeta por defecto
                  </button>
                )}
              </div>
            )}

            <div className="border-t border-surface-600 pt-4">
              {/* Send to Notion toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-200">Enviar a Notion</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Crea una página con resumen + transcripción colapsable.
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ sendToNotion: !settings.sendToNotion })}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.sendToNotion ? "bg-brand-600" : "bg-surface-600"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.sendToNotion ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </label>

              {settings.sendToNotion && !settings.notionApiKey && (
                <p className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                  <ExternalLink size={11} />
                  Configura la API key de Notion arriba para habilitarlo.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Custom Prompt ─────────────────────────────────────────────────── */}
        <section className="card">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader
              title="Prompt del Sistema (Personalizado)"
            />
            <button
              onClick={() => setSettings({ customPrompt: DEFAULT_SYSTEM_PROMPT })}
              className="btn-ghost text-xs py-1 -mt-1"
            >
              <RotateCcw size={12} />
              Restaurar default
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Variables disponibles:{" "}
            <code className="bg-surface-700 px-1 rounded text-brand-400">{"{{video_title}}"}</code>{" "}
            <code className="bg-surface-700 px-1 rounded text-brand-400">{"{{channel}}"}</code>{" "}
            <code className="bg-surface-700 px-1 rounded text-brand-400">{"{{duration}}"}</code>{" "}
            <code className="bg-surface-700 px-1 rounded text-brand-400">{"{{transcript}}"}</code>
          </p>
          <textarea
            value={settings.customPrompt}
            onChange={(e) => setSettings({ customPrompt: e.target.value })}
            rows={18}
            className="input-field font-mono text-xs resize-y leading-relaxed"
            spellCheck={false}
          />
          <p className="mt-2 text-xs text-gray-600">
            {settings.customPrompt.length.toLocaleString()} caracteres ·{" "}
            {Math.ceil(settings.customPrompt.length / 4).toLocaleString()} tokens aprox.
          </p>
        </section>
      </div>
    </div>
  );
}
