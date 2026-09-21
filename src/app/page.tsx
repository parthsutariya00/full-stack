import Link from "next/link";
import { ProjectForm } from "@/components/ProjectForm";
import { ProgressBar, StatTiles } from "@/components/StatTiles";
import { formatDate } from "@/lib/labels";
import { countWorkspaceTotals, listProjects } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, totals] = await Promise.all([listProjects(), countWorkspaceTotals()]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Every number below is read from PostgreSQL on each request.
          </p>
        </div>
        <StatTiles stats={totals} projectCount={projects.length} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">Projects</h2>

          {projects.length === 0 ? (
            <div className="card text-sm text-slate-400">
              No projects yet. Create one on the right to get started.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="card block space-y-3 transition hover:border-slate-600"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">
                          {project.name}
                        </h3>
                        <p className="line-clamp-2 text-xs text-slate-400">
                          {project.description ?? "No description"}
                        </p>
                      </div>
                    </div>

                    <ProgressBar value={project.stats.completion} color={project.color} />

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {project.stats.done}/{project.stats.total} done
                        {project.stats.overdue > 0 ? (
                          <span className="ml-2 text-rose-400">
                            {project.stats.overdue} overdue
                          </span>
                        ) : null}
                      </span>
                      <span>{formatDate(project.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ProjectForm />
      </section>
    </div>
  );
}
