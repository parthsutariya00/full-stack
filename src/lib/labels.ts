import { TaskPriority, TaskStatus } from "@prisma/client";

export const STATUS_ORDER: readonly TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.DONE,
];

export const PRIORITY_ORDER: readonly TaskPriority[] = [
  TaskPriority.URGENT,
  TaskPriority.HIGH,
  TaskPriority.MEDIUM,
  TaskPriority.LOW,
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: "border-slate-700 bg-slate-800/60 text-slate-300",
  IN_PROGRESS: "border-sky-800 bg-sky-950/60 text-sky-300",
  BLOCKED: "border-amber-800 bg-amber-950/60 text-amber-300",
  DONE: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: "border-slate-700 bg-slate-800/60 text-slate-400",
  MEDIUM: "border-indigo-800 bg-indigo-950/60 text-indigo-300",
  HIGH: "border-orange-800 bg-orange-950/60 text-orange-300",
  URGENT: "border-rose-800 bg-rose-950/60 text-rose-300",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Deterministic on server and client — no hydration drift. */
export function formatDate(isoDate: string): string {
  const parsed = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00.000Z` : isoDate);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormatter.format(parsed);
}

export function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (dueDate === null || status === TaskStatus.DONE) {
    return false;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${dueDate}T00:00:00.000Z`).getTime() < today.getTime();
}
