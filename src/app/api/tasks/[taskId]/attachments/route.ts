import { NextResponse } from "next/server";
import { invalidateProject } from "@/lib/cache";
import { badRequest, notFoundResponse, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { toAttachmentDTO } from "@/lib/queries";
import { buildObjectKey, deleteObject, getStorage, putObject } from "@/lib/storage";
import type { ApiError, AttachmentDTO } from "@/lib/types";
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB, isAllowedImageType, safeFilename } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

/**
 * Multipart image upload for one task: field `file`, one image per request.
 *
 * A route handler rather than a server action, for two reasons — server actions
 * cap the request body at 1MB, and pushing the bytes from the server means the
 * browser never talks to the bucket, so no CORS rule is needed on it.
 *
 * There is no auth layer in this app yet, so anyone who can reach this route can
 * attach an image to any task. Add the session check here once one exists.
 */

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

/** `File` is not a global on Node 18; `Blob` is, and form files carry a `name`. */
type UploadedFile = Blob & { name?: string };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AttachmentDTO | ApiError>> {
  const { taskId } = await context.params;
  const client = getStorage();

  if (client === null) {
    return NextResponse.json<ApiError>(
      { error: "Image storage is not configured" },
      { status: 503 },
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });

  if (task === null) {
    return notFoundResponse("Task not found");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return badRequest("Request body must be multipart form data");
  }

  const entry = form.get("file");

  if (!(entry instanceof Blob)) {
    return badRequest("Attach the image as the `file` field");
  }

  const file: UploadedFile = entry;
  const filename = safeFilename(typeof file.name === "string" ? file.name : "image");

  if (!isAllowedImageType(file.type)) {
    return badRequest("Only PNG, JPEG, WebP, GIF and AVIF images are allowed");
  }
  if (file.size === 0) {
    return badRequest("That file is empty");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return badRequest(`Image must be ${MAX_IMAGE_MB}MB or smaller`);
  }

  const key = buildObjectKey(taskId, filename, file.type);

  try {
    await putObject(client, key, await file.arrayBuffer(), file.type);
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }

  try {
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        key,
        filename,
        contentType: file.type,
        size: file.size,
      },
    });

    await invalidateProject(task.projectId);
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath(`/projects/${task.projectId}/tasks/${taskId}`);

    return NextResponse.json<AttachmentDTO>(toAttachmentDTO(attachment), { status: 201 });
  } catch (caught) {
    // The object is already in the bucket; drop it rather than leave it orphaned.
    await deleteObject(client, key);
    return serverError(caught instanceof Error ? caught : null);
  }
}
