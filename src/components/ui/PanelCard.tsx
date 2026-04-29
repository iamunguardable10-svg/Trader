import { cn } from "@/lib/cn";

type Props = {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  titleRight?: React.ReactNode;
};

export function PanelCard({ title, icon, children, className, titleRight }: Props) {
  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/60 p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {icon && <span className="mr-1.5">{icon}</span>}
          {title}
        </h3>
        {titleRight}
      </div>
      {children}
    </div>
  );
}
