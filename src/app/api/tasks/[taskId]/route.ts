import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { badRequest, notFoundResponse, readJsonBody, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getTask, toTaskDTO } from "@/lib/queries";
import type { ApiError, TaskDTO } from "@/lib/types";
import { taskPatchApiSchema, toFieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<TaskDTO | ApiError>> {
  const { taskId } = await context.params;

  try {
    const task = await getTask(taskId);
    return task === null ? notFoundResponse("Task not found") : NextResponse.json<TaskDTO>(task);
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<TaskDTO | ApiError>> {
  const { taskId } = await context.params;
  const body = await readJsonBody(request);

  if (body === null) {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = taskPatchApiSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed", toFieldErrors(parsed.error));
  }

  const data: Prisma.TaskUpdateInput = {};

  if (parsed.data.title !== undefined) {
    data.title = parsed.data.title;
  }
  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description;
  }
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
  }
  if (parsed.data.priority !== undefined) {
    data.priority = parsed.data.priority;
  }
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate;
  }

  try {
    const task = await prisma.task.update({ where: { id: taskId }, data });
    return NextResponse.json<TaskDTO>(toTaskDTO(task));
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<{ deleted: string } | ApiError>> {
  const { taskId } = await context.params;

  try {
    await prisma.task.delete({ where: { id: taskId } });
    return NextResponse.json({ deleted: taskId });
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}
