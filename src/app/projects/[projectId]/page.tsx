import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { FilterBar } from "@/components/FilterBar";
import { StatTiles } from "@/components/StatTiles";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { getProjectDetail } from "@/lib/queries";
import { parseTaskFilters } from "@/lib/validation";
import type { SearchParamsRecord } from "@/lib/validation";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const [{ projectId }, rawSearchParams] = await Promise.all([params, searchParams]);
  const filters = parseTaskFilters(rawSearchParams);
  const project = await getProjectDetail(projectId, filters);

  if (project === null) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← Back to dashboard
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-2 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">{project.name}</h1>
              <p className="text-sm text-slate-400">
                {project.description ?? "No description"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/projects/${project.id}/edit`} className="btn-ghost">
              Edit project
            </Link>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </div>

        <StatTiles stats={project.stats} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <FilterBar
            projectId={project.id}
            filters={filters}
            resultCount={project.tasks.length}
          />

          {project.tasks.length === 0 ? (
            <div className="card text-sm text-slate-400">
              {project.stats.total === 0
                ? "No tasks yet — add the first one on the right."
                : "No tasks match the current filters."}
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {project.tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard task={task} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <TaskForm projectId={project.id} />
      </section>
    </div>
  );
}
