import { NextResponse } from "next/server";
import { badRequest, readJsonBody, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { listProjects, toProjectDTO } from "@/lib/queries";
import type { ProjectDTO, ProjectSummary } from "@/lib/types";
import { projectApiSchema, toFieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ProjectSummary[] | { error: string }>> {
  try {
    const projects = await listProjects();
    return NextResponse.json<ProjectSummary[]>(projects);
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<ProjectDTO | { error: string }>> {
  const body = await readJsonBody(request);

  if (body === null) {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = projectApiSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Validation failed", toFieldErrors(parsed.error));
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        color: parsed.data.color ?? "#6366f1",
      },
    });

    return NextResponse.json<ProjectDTO>(toProjectDTO(project), { status: 201 });
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}
