import { NextResponse } from "next/server";
import { badRequest, notFoundResponse, readJsonBody, serverError } from "@/lib/http";
import { invalidateProject } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { toTaskDTO } from "@/lib/queries";
import type { ApiError, TaskDTO } from "@/lib/types";
import { taskCreateApiSchema, toFieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<TaskDTO[] | ApiError>> {
  const { projectId } = await context.params;

  try {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json<TaskDTO[]>(tasks.map(toTaskDTO));
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<TaskDTO | ApiError>> {
  const { projectId } = await context.params;
  const body = await readJsonBody(request);

  if (body === null) {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = taskCreateApiSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed", toFieldErrors(parsed.error));
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (project === null) {
    return notFoundResponse("Project not found");
  }

  try {
    const task = await prisma.task.create({
      data: {
        projectId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status ?? "TODO",
        priority: parsed.data.priority ?? "MEDIUM",
        dueDate: parsed.data.dueDate ?? null,
      },
    });

    await invalidateProject(projectId);
    return NextResponse.json<TaskDTO>(toTaskDTO(task), { status: 201 });
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}
