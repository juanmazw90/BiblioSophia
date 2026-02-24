import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  LogEntry,
  ProcessResult,
  ProcessStage,
  UsageEntry,
} from "../types";

// ─── Store State ──────────────────────────────────────────────────────────────

interface AppState {
  // Navigation
  activeTab: "process" | "result" | "dashboard" | "settings";
  setActiveTab: (tab: AppState["activeTab"]) => void;

  // Processing
  url: string;
  setUrl: (url: string) => void;
  stage: ProcessStage;
  setStage: (stage: ProcessStage) => void;
  log: LogEntry[];
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLog: () => void;
  currentResult: ProcessResult | null;
  setResult: (result: ProcessResult | null) => void;
  errorMessage: string;
  setError: (msg: string) => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;

  // Usage history
  usageHistory: UsageEntry[];
  addUsageEntry: (entry: UsageEntry) => void;
  loadUsageHistory: () => Promise<void>;
  saveUsageHistory: () => Promise<void>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activeTab: "process",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Processing
  url: "",
  setUrl: (url) => set({ url }),
  stage: "idle",
  setStage: (stage) => set({ stage }),
  log: [],
  addLog: (entry) =>
    set((state) => ({
      log: [
        ...state.log,
        {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),
  clearLog: () => set({ log: [] }),
  currentResult: null,
  setResult: (result) => set({ currentResult: result }),
  errorMessage: "",
  setError: (errorMessage) => set({ errorMessage }),

  // Settings
  settings: DEFAULT_SETTINGS,
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  loadSettings: async () => {
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      const saved = await store.get<AppSettings>("app_settings");
      if (saved) {
        set({ settings: { ...DEFAULT_SETTINGS, ...saved } });
      }
    } catch (e) {
      console.warn("Could not load settings:", e);
    }
  },

  saveSettings: async () => {
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      await store.set("app_settings", get().settings);
      await store.save();
    } catch (e) {
      console.error("Could not save settings:", e);
    }
  },

  // Usage history
  usageHistory: [],

  addUsageEntry: (entry) => {
    set((state) => ({
      usageHistory: [entry, ...state.usageHistory].slice(0, 200), // keep last 200
    }));
    get().saveUsageHistory();
  },

  loadUsageHistory: async () => {
    try {
      const store = await load("usage.json", { autoSave: false, defaults: {} });
      const history = await store.get<UsageEntry[]>("history");
      if (history) {
        set({ usageHistory: history });
      }
    } catch (e) {
      console.warn("Could not load usage history:", e);
    }
  },

  saveUsageHistory: async () => {
    try {
      const store = await load("usage.json", { autoSave: false, defaults: {} });
      await store.set("history", get().usageHistory);
      await store.save();
    } catch (e) {
      console.error("Could not save usage history:", e);
    }
  },
}));
