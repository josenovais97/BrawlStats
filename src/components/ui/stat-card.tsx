import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  /** A lucide component. Ignored when `node` is given. */
  icon?: LucideIcon;
  /**
   * Pre-rendered mark, for the game's own artwork. Takes precedence over
   * `icon` so a card can use a real Brawl Stars asset instead of a line icon.
   */
  node?: ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** Tailwind text colour class for the icon, e.g. "text-brand". */
  tone?: string;
}

export function StatCard({
  icon: Icon,
  node,
  label,
  value,
  hint,
  tone = "text-brand",
}: StatCardProps) {
  return (
    <div className="card card-glow flex items-center gap-3 p-4">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 ${tone}`}
      >
        {node ?? (Icon ? <Icon className="size-5" /> : null)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="truncate text-lg font-bold tabular-nums">{value}</p>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
