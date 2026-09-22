import { TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import type { ProjectDetail, ProjectStats, ProjectSummary } from "@/lib/types";

/**
 * Runtime shapes for anything that round-trips through Redis. Cached JSON is data
 * from outside the process, so it is parsed rather than trusted — a schema change
 * turns a stale entry into a cache miss instead of a malformed object.
 *
 * Annotating each schema as `z.ZodType<TheDTO>` makes TypeScript fail here if a
 * DTO and its schema ever drift apart.
 */

export const projectStatsSchema: z.ZodType<ProjectStats> = z.object({
  total: z.number().int(),
  done: z.number().int(),
  open: z.number().int(),
  overdue: z.number().int(),
  completion: z.number().int(),
});

const projectFields = {
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  createdAt: z.string(),
});

const taskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(TaskStatus),
  priority: z.enum(TaskPriority),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attachments: z.array(attachmentSchema),
});

export const projectSummaryListSchema: z.ZodType<ProjectSummary[]> = z.array(
  z.object({ ...projectFields, stats: projectStatsSchema }),
);

export const projectDetailSchema: z.ZodType<ProjectDetail> = z.object({
  ...projectFields,
  stats: projectStatsSchema,
  tasks: z.array(taskSchema),
});
