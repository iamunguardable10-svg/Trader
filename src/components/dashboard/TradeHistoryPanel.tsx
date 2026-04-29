import { TradeHistoryEntry } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMinutes, formatPrice, getPctColor } from "@/lib/utils";

type Props = { history: TradeHistoryEntry[] };

const DECISION_STYLE: Record<string, string> = {
  LONG:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  SHORT:    "bg-red-500/10 text-red-400 border-red-500/20",
  NO_TRADE: "bg-zinc-700/30 text-zinc-500 border-zinc-600/20",
};

const STATUS_STYLE: Record<string, string> = {
  open:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  closed:  "bg-zinc-700/30 text-zinc-400 border-zinc-600/20",
  skipped: "bg-zinc-800/40 text-zinc-600 border-zinc-700/20",
};

export function TradeHistoryPanel({ history }: Props) {
  return (
    <PanelCard title="Trade History" icon="🗂️">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
          <span className="text-2xl mb-2">📭</span>
          <p className="text-xs">No trades yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Time", "Ticker", "Signal", "Score", "Entry", "Exit", "PnL", "Hold", "Status", "Exit Reason"].map(h => (
                  <th key={h} className="pb-2 px-2 text-left font-medium text-zinc-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-2 px-2 text-zinc-500 whitespace-nowrap">
                    {formatDate(entry.timestamp)}
                  </td>
                  <td className="py-2 px-2 font-semibold text-zinc-200">
                    {entry.ticker}
                  </td>
                  <td className="py-2 px-2">
                    <Badge className={DECISION_STYLE[entry.decision]}>
                      {entry.decision}
                    </Badge>
                  </td>
                  <td className={`py-2 px-2 font-medium ${entry.score >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {entry.score > 0 ? "+" : ""}{entry.score.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-zinc-300">
                    {entry.entry_price != null ? formatPrice(entry.entry_price) : "—"}
                  </td>
                  <td className="py-2 px-2 text-zinc-300">
                    {entry.exit_price != null ? formatPrice(entry.exit_price) : "—"}
                  </td>
                  <td className={`py-2 px-2 font-semibold ${entry.pnl != null ? getPctColor(entry.pnl) : "text-zinc-600"}`}>
                    {entry.pnl != null
                      ? `${entry.pnl > 0 ? "+" : ""}$${Math.abs(entry.pnl).toFixed(0)}`
                      : "—"}
                    {entry.pnl_pct != null && (
                      <span className="ml-1 text-zinc-500">
                        ({entry.pnl_pct > 0 ? "+" : ""}{entry.pnl_pct.toFixed(2)}%)
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-zinc-400">
                    {entry.hold_minutes != null ? formatMinutes(entry.hold_minutes) : "—"}
                  </td>
                  <td className="py-2 px-2">
                    <Badge className={STATUS_STYLE[entry.status]}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-zinc-500 max-w-[140px] truncate">
                    {entry.exit_reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}
