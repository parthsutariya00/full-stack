import { TaskStatus } from "@prisma/client";
import type { Prisma, Project, Task } from "@prisma/client";
import { CACHE_TTL, cacheKeys, cached, cachedNullable } from "@/lib/cache";
import {
  projectDetailSchema,
  projectStatsSchema,
  projectSummaryListSchema,
} from "@/lib/dto-schemas";
import { prisma } from "@/lib/prisma";
import type {
  ProjectDetail,
  ProjectDTO,
  ProjectStats,
  ProjectSummary,
  TaskDTO,
  TaskFilters,
} from "@/lib/types";

type StatusCount = { status: TaskStatus; dueDate: Date | null };

export function toProjectDTO(project: Project): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate === null ? null : task.dueDate.toISOString().slice(0, 10),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function buildStats(tasks: StatusCount[]): ProjectStats {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  let done = 0;
  let overdue = 0;

  for (const task of tasks) {
    if (task.status === TaskStatus.DONE) {
      done += 1;
      continue;
    }
    if (task.dueDate !== null && task.dueDate.getTime() < startOfToday.getTime()) {
      overdue += 1;
    }
  }

  const total = tasks.length;

  return {
    total,
    done,
    open: total - done,
    overdue,
    completion: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return cached(
    cacheKeys.projectList(),
    CACHE_TTL.projectList,
    projectSummaryListSchema,
    async (): Promise<ProjectSummary[]> => {
      const projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: { tasks: { select: { status: true, dueDate: true } } },
      });

      return projects.map((project) => ({
        ...toProjectDTO(project),
        stats: buildStats(project.tasks),
      }));
    },
  );
}

export async function countWorkspaceTotals(): Promise<ProjectStats> {
  return cached(
    cacheKeys.workspaceStats(),
    CACHE_TTL.workspaceStats,
    projectStatsSchema,
    async (): Promise<ProjectStats> => {
      const tasks = await prisma.task.findMany({ select: { status: true, dueDate: true } });
      return buildStats(tasks);
    },
  );
}

function buildTaskWhere(projectId: string, filters: TaskFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { projectId };

  if (filters.status !== "ALL") {
    where.status = filters.status;
  }
  if (filters.priority !== "ALL") {
    where.priority = filters.priority;
  }
  if (filters.search.length > 0) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildTaskOrder(filters: TaskFilters): Prisma.TaskOrderByWithRelationInput[] {
  switch (filters.sort) {
    case "due":
      return [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
    case "priority":
      // Enum order in the schema runs LOW -> URGENT, so descending puts URGENT first.
      return [{ priority: "desc" }, { createdAt: "desc" }];
    case "title":
      return [{ title: "asc" }];
    case "created":
    default:
      return [{ createdAt: "desc" }];
  }
}

async function loadProjectDetail(
  projectId: string,
  filters: TaskFilters,
): Promise<ProjectDetail | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (project === null) {
    return null;
  }

  const [tasks, allTaskStates] = await Promise.all([
    prisma.task.findMany({
      where: buildTaskWhere(projectId, filters),
      orderBy: buildTaskOrder(filters),
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { status: true, dueDate: true },
    }),
  ]);

  return {
    ...toProjectDTO(project),
    stats: buildStats(allTaskStates),
    tasks: tasks.map(toTaskDTO),
  };
}

export async function getProjectDetail(
  projectId: string,
  filters: TaskFilters,
): Promise<ProjectDetail | null> {
  return cachedNullable(
    cacheKeys.projectDetail(projectId, filters),
    CACHE_TTL.projectDetail,
    projectDetailSchema,
    (): Promise<ProjectDetail | null> => loadProjectDetail(projectId, filters),
  );
}

export async function getTask(taskId: string): Promise<TaskDTO | null> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  return task === null ? null : toTaskDTO(task);
}

export async function getProject(projectId: string): Promise<ProjectDTO | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return project === null ? null : toProjectDTO(project);
}
