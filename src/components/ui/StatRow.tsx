type Props = {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
};

export function StatRow({ label, value, valueClass }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${valueClass ?? "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}
