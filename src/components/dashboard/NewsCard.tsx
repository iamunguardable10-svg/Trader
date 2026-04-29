import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

type Props = { news: TradeDecision["news"] };

function PercentBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-zinc-300 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function NewsCard({ news }: Props) {
  return (
    <PanelCard title="News Signal" icon="📰">
      {/* Headline */}
      <div className="mb-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3">
        {news.url ? (
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-zinc-100 hover:text-blue-400 transition-colors leading-snug"
          >
            {news.headline}
          </a>
        ) : (
          <p className="text-sm font-medium text-zinc-100 leading-snug">{news.headline}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{news.source}</span>
          <span>·</span>
          <span>{formatDate(news.published_at)}</span>
        </div>
      </div>

      {/* Event type + bias */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">
          {news.event_type.replace(/_/g, " ")}
        </Badge>
        <TrendBadge trend={news.directional_bias} />
      </div>

      {/* Importance + Surprise */}
      <div className="mb-3 space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Importance</span>
          </div>
          <PercentBar value={news.importance} color="bg-blue-500" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Surprise Level</span>
          </div>
          <PercentBar value={news.surprise_level} color="bg-purple-500" />
        </div>
      </div>

      {/* Reasoning */}
      <div className="mb-3 rounded-lg bg-zinc-800/40 p-2.5">
        <p className="text-xs font-medium text-zinc-400 mb-1">Reasoning</p>
        <p className="text-xs text-zinc-300 leading-relaxed">{news.reasoning_summary}</p>
      </div>

      {/* Key risks */}
      {news.key_risks.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">Key Risks</p>
          <ul className="space-y-1">
            {news.key_risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                <span className="mt-0.5 text-amber-500">⚠</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelCard>
  );
}
