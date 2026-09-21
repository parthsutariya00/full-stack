import type { TaskPriority, TaskStatus } from "@prisma/client";

/** Every JSON value an API request body or response can hold. Replaces `unknown`. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Serialisable project shape handed to client components. */
export type ProjectDTO = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectStats = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  completion: number;
};

export type ProjectSummary = ProjectDTO & {
  stats: ProjectStats;
};

/** Serialisable task shape handed to client components. */
export type TaskDTO = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date (`YYYY-MM-DD`) or null. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectDTO & {
  stats: ProjectStats;
  tasks: TaskDTO[];
};

export const TASK_SORT_KEYS = ["created", "due", "priority", "title"] as const;
export type TaskSortKey = (typeof TASK_SORT_KEYS)[number];

export type TaskFilters = {
  status: TaskStatus | "ALL";
  priority: TaskPriority | "ALL";
  search: string;
  sort: TaskSortKey;
};

/** Field name -> validation messages, as produced by zod's flattened error. */
export type FieldErrors = Record<string, string[] | undefined>;

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors: FieldErrors };

export const IDLE_FORM_STATE: FormState = { status: "idle" };

export type ApiError = {
  error: string;
  fieldErrors?: FieldErrors;
};
