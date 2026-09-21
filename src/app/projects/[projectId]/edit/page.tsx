import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/ProjectForm";
import { getProject } from "@/lib/queries";

export const dynamic = "force-dynamic";

type EditProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (project === null) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/projects/${project.id}`}
        className="text-xs text-slate-500 hover:text-slate-300"
      >
        ← Back to {project.name}
      </Link>
      <ProjectForm project={project} />
    </div>
  );
}
