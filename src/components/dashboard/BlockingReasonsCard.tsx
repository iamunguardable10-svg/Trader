type Props = { reasons: string[] };

export function BlockingReasonsCard({ reasons }: Props) {
  if (reasons.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-400">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs">!</span>
        Trade Blocked
      </h3>
      <ul className="space-y-2">
        {reasons.map((reason, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2"
          >
            <span className="mt-0.5 text-red-400 text-xs">✗</span>
            <span className="text-sm text-red-300">{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
