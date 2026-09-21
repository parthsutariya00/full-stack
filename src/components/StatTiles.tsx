import type { ProjectStats } from "@/lib/types";

type StatTilesProps = {
  stats: ProjectStats;
  projectCount?: number;
};

export function StatTiles({ stats, projectCount }: StatTilesProps) {
  const tiles: { label: string; value: string; tone: string }[] = [
    ...(projectCount === undefined
      ? []
      : [{ label: "Projects", value: String(projectCount), tone: "text-white" }]),
    { label: "Tasks", value: String(stats.total), tone: "text-white" },
    { label: "Open", value: String(stats.open), tone: "text-sky-300" },
    { label: "Overdue", value: String(stats.overdue), tone: "text-rose-300" },
    { label: "Done", value: `${stats.completion}%`, tone: "text-emerald-300" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{tile.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${tile.tone}`}>{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}
