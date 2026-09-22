import { NextResponse } from "next/server";
import { notFoundResponse, serverError } from "@/lib/http";
import { invalidateProject } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { getProjectDetail } from "@/lib/queries";
import { deleteObjects } from "@/lib/storage";
import type { ApiError, ProjectDetail } from "@/lib/types";
import { parseTaskFilters } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ProjectDetail | ApiError>> {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const filters = parseTaskFilters({
    status: url.searchParams.get("status") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  });

  try {
    const project = await getProjectDetail(projectId, filters);

    if (project === null) {
      return notFoundResponse("Project not found");
    }

    return NextResponse.json<ProjectDetail>(project);
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<{ deleted: string } | ApiError>> {
  const { projectId } = await context.params;

  try {
    // Cascade clears the rows; the bucket objects have to be removed by hand.
    const orphans = await prisma.taskAttachment.findMany({
      where: { task: { projectId } },
      select: { key: true },
    });

    await prisma.project.delete({ where: { id: projectId } });
    await deleteObjects(orphans.map((attachment) => attachment.key));
    await invalidateProject(projectId);
    return NextResponse.json({ deleted: projectId });
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}
