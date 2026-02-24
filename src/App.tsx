import { useEffect } from "react";
import { BookOpen, BarChart3, Settings, FileText } from "lucide-react";
import { useAppStore } from "./store/useAppStore";
import MainScreen from "./components/MainScreen";
import ResultView from "./components/ResultView";
import Dashboard from "./components/Dashboard";
import SettingsPanel from "./components/Settings";
import clsx from "clsx";

type Tab = "process" | "result" | "dashboard" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "process", label: "Procesar", icon: <BookOpen size={16} /> },
  { id: "result", label: "Resultado", icon: <FileText size={16} /> },
  { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { id: "settings", label: "Ajustes", icon: <Settings size={16} /> },
];

export default function App() {
  const { activeTab, setActiveTab, currentResult, loadSettings, loadUsageHistory } =
    useAppStore();

  useEffect(() => {
    loadSettings();
    loadUsageHistory();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-surface-800 border-r border-surface-600 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-surface-600">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="BiblioSophia"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Biblio</p>
              <p className="text-brand-500 font-bold text-sm leading-tight">Sophia</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.id === "result" && !currentResult}
              className={clsx(
                "tab-btn w-full justify-start",
                activeTab === tab.id ? "tab-btn-active" : "tab-btn-inactive",
                tab.id === "result" && !currentResult && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-400"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === "result" && currentResult && (
                <span className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Version badge */}
        <div className="p-4 border-t border-surface-600">
          <p className="text-gray-600 text-xs font-mono">v0.1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "process" && <MainScreen />}
        {activeTab === "result" && <ResultView />}
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}
