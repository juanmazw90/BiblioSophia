import { useMemo } from "react";
import { BarChart3, TrendingUp, Clock, Coins, Film, Trash2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { format, parseISO, isThisMonth } from "date-fns";
import { es } from "date-fns/locale";

function StatCard({
  label,
  value,
  sub,
  icon,
  color = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className="w-10 h-10 bg-surface-700 rounded-lg flex items-center justify-center text-brand-500 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ProviderBar({
  label,
  cost,
  maxCost,
  color,
}: {
  label: string;
  cost: number;
  maxCost: number;
  color: string;
}) {
  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-300 w-36 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 bg-surface-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono text-gray-300 w-16 text-right flex-shrink-0">
        ${cost.toFixed(4)}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { usageHistory, saveUsageHistory } = useAppStore();

  const thisMonth = useMemo(
    () => usageHistory.filter((e) => isThisMonth(parseISO(e.timestamp))),
    [usageHistory]
  );

  const stats = useMemo(() => {
    const totalCost = thisMonth.reduce((s, e) => s + e.costUsd, 0);
    const totalTokens = thisMonth.reduce((s, e) => s + e.tokensUsed, 0);
    const totalMinutes = thisMonth.reduce((s, e) => s + e.audioDurationSeconds / 60, 0);
    const byProvider: Record<string, { cost: number; tokens: number }> = {};

    for (const e of thisMonth) {
      if (!byProvider[e.summaryProvider]) {
        byProvider[e.summaryProvider] = { cost: 0, tokens: 0 };
      }
      byProvider[e.summaryProvider].cost += e.costUsd;
      byProvider[e.summaryProvider].tokens += e.tokensUsed;
    }

    const maxCost = Math.max(...Object.values(byProvider).map((v) => v.cost), 0.0001);
    return { totalCost, totalTokens, totalMinutes, byProvider, maxCost };
  }, [thisMonth]);

  const PROVIDER_COLORS: Record<number, string> = {
    0: "bg-brand-600",
    1: "bg-purple-600",
    2: "bg-blue-600",
    3: "bg-green-600",
  };

  const handleClearHistory = async () => {
    if (!window.confirm("¿Eliminar todo el historial de uso? Esta acción no se puede deshacer.")) return;
    useAppStore.setState({ usageHistory: [] });
    await saveUsageHistory();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard de Consumo</h1>
          <p className="text-gray-400 text-sm mt-1">
            Métricas del mes actual · {thisMonth.length} videos procesados
          </p>
        </div>
        {usageHistory.length > 0 && (
          <button onClick={handleClearHistory} className="btn-ghost text-xs text-red-400 hover:text-red-300">
            <Trash2 size={13} />
            Limpiar historial
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pb-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Costo total (este mes)"
            value={`$${stats.totalCost.toFixed(4)}`}
            icon={<Coins size={18} />}
            color={stats.totalCost > 5 ? "text-yellow-400" : "text-white"}
          />
          <StatCard
            label="Tokens usados"
            value={stats.totalTokens.toLocaleString()}
            sub="entrada + salida"
            icon={<TrendingUp size={18} />}
          />
          <StatCard
            label="Minutos transcritos"
            value={stats.totalMinutes.toFixed(1) + " min"}
            icon={<Clock size={18} />}
          />
          <StatCard
            label="Videos procesados"
            value={String(thisMonth.length)}
            sub={`${usageHistory.length} en total`}
            icon={<Film size={18} />}
          />
        </div>

        {/* Provider breakdown */}
        {Object.keys(stats.byProvider).length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={16} />
              Costos por modelo
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.byProvider).map(([provider, data], i) => (
                <ProviderBar
                  key={provider}
                  label={provider}
                  cost={data.cost}
                  maxCost={stats.maxCost}
                  color={PROVIDER_COLORS[i % 4]}
                />
              ))}
            </div>
          </div>
        )}

        {/* History table */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Historial reciente</h3>
          {usageHistory.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              Aún no hay registros de uso. Procesa un video para empezar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-surface-600">
                    <th className="text-left pb-2 pr-4 font-medium">Fecha</th>
                    <th className="text-left pb-2 pr-4 font-medium">Video</th>
                    <th className="text-left pb-2 pr-4 font-medium">Modelo</th>
                    <th className="text-right pb-2 pr-4 font-medium">Tokens</th>
                    <th className="text-right pb-2 font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.slice(0, 50).map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-surface-700/50 hover:bg-surface-700/20 transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {format(parseISO(entry.timestamp), "dd MMM HH:mm", { locale: es })}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-300 max-w-[200px]">
                        <p className="truncate" title={entry.videoTitle}>
                          {entry.videoTitle}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                        {entry.summaryProvider.replace("claude-3-5-", "").replace("claude-", "")}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-300 font-mono text-xs">
                        {entry.tokensUsed.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-gray-300 font-mono text-xs">
                        ${entry.costUsd.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usageHistory.length > 50 && (
                <p className="text-center text-xs text-gray-600 mt-3">
                  Mostrando últimas 50 de {usageHistory.length} entradas
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
