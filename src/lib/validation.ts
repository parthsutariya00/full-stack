import { TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { TASK_SORT_KEYS } from "@/lib/types";
import type { FieldErrors, TaskFilters } from "@/lib/types";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Trimmed text that becomes `null` when empty. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value): string | null => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });

/** `YYYY-MM-DD` from an `<input type="date">`, or `null` when left blank. */
const optionalDueDate = z
  .string()
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine(
    (value): boolean =>
      value === null || (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))),
    { message: "Due date must be a valid calendar date" },
  )
  .transform((value): Date | null =>
    value === null ? null : new Date(`${value}T00:00:00.000Z`),
  );

export const projectInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name needs at least 2 characters")
    .max(80, "Name must be 80 characters or fewer"),
  description: optionalText(500, "Description"),
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR, "Color must be a hex value such as #6366f1"),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const taskInputSchema = z.object({
  projectId: z.string().trim().min(1, "A project is required"),
  title: z
    .string()
    .trim()
    .min(2, "Title needs at least 2 characters")
    .max(140, "Title must be 140 characters or fewer"),
  description: optionalText(1000, "Description"),
  status: z.enum(TaskStatus),
  priority: z.enum(TaskPriority),
  dueDate: optionalDueDate,
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskStatusChangeSchema = z.object({
  taskId: z.string().trim().min(1),
  status: z.enum(TaskStatus),
});

export const idSchema = z.object({
  id: z.string().trim().min(1, "An id is required"),
});

/** JSON body accepted by `POST /api/projects`. */
export const projectApiSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(500, "Description").optional(),
  color: z.string().trim().regex(HEX_COLOR, "Color must be a hex value").optional(),
});

/** JSON body accepted by `PATCH /api/tasks/[taskId]`. */
export const taskPatchApiSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: optionalText(1000, "Description"),
    status: z.enum(TaskStatus),
    priority: z.enum(TaskPriority),
    dueDate: optionalDueDate,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

/** JSON body accepted by `POST /api/projects/[projectId]/tasks`. */
export const taskCreateApiSchema = taskInputSchema
  .omit({ projectId: true })
  .partial({ status: true, priority: true, description: true, dueDate: true });

const filtersSchema = z.object({
  status: z.union([z.enum(TaskStatus), z.literal("ALL")]).catch("ALL"),
  priority: z.union([z.enum(TaskPriority), z.literal("ALL")]).catch("ALL"),
  search: z.string().trim().max(120).catch(""),
  sort: z.enum(TASK_SORT_KEYS).catch("created"),
});

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function parseTaskFilters(params: SearchParamsRecord): TaskFilters {
  return filtersSchema.parse({
    status: firstValue(params.status) ?? "ALL",
    priority: firstValue(params.priority) ?? "ALL",
    search: firstValue(params.search) ?? "",
    sort: firstValue(params.sort) ?? "created",
  });
}

/** Reads a form field as a trimmed string; non-text entries collapse to "". */
export function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Flattens zod issues into `{ fieldName: [message, ...] }`; rootless issues land on `form`. */
export function toFieldErrors<T>(error: z.ZodError<T>): FieldErrors {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const key =
      issue.path.length > 0 ? issue.path.map((part) => String(part)).join(".") : "form";
    const existing = fieldErrors[key];

    if (existing) {
      existing.push(issue.message);
    } else {
      fieldErrors[key] = [issue.message];
    }
  }

  return fieldErrors;
}
