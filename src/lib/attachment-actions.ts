"use server";

import { revalidatePath } from "next/cache";
import { invalidateProject } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { deleteObject, getStorage } from "@/lib/storage";

/**
 * Removing an image. Uploads go through `POST /api/tasks/[taskId]/attachments`
 * instead of a server action, because a route handler can take a multipart body
 * of any size while a server action is capped (1MB by default).
 *
 * There is no auth layer in this app yet, so anyone who can reach it can delete
 * an image. Add the session check here once one exists.
 */
export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const attachmentId = formData.get("attachmentId");

  if (typeof attachmentId !== "string" || attachmentId.length === 0) {
    return;
  }

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    select: { key: true, taskId: true, task: { select: { projectId: true } } },
  });

  if (attachment === null) {
    return;
  }

  // Row first: an orphaned object is cheap, a row pointing at nothing is a broken image.
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });

  const client = getStorage();

  if (client !== null) {
    await deleteObject(client, attachment.key);
  }

  await invalidateProject(attachment.task.projectId);
  revalidatePath(`/projects/${attachment.task.projectId}`);
  revalidatePath(`/projects/${attachment.task.projectId}/tasks/${attachment.taskId}`);
}
