import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskForm } from "@/components/TaskForm";
import { formatDate } from "@/lib/labels";
import { getTask } from "@/lib/queries";
import { isStorageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

type EditTaskPageProps = {
  params: Promise<{ projectId: string; taskId: string }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const { projectId, taskId } = await params;
  const task = await getTask(taskId);

  if (task === null || task.projectId !== projectId) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/projects/${projectId}`} className="text-xs text-slate-500 hover:text-slate-300">
        ← Back to project
      </Link>
      <TaskForm projectId={projectId} task={task} />
      <TaskAttachments
        taskId={task.id}
        attachments={task.attachments}
        storageReady={isStorageConfigured()}
      />
      <p className="text-xs text-slate-600">
        Created {formatDate(task.createdAt)} · last updated {formatDate(task.updatedAt)}
      </p>
    </div>
  );
}
