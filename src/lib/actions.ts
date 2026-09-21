"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalidateProject } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/types";
import {
  idSchema,
  projectInputSchema,
  readField,
  taskInputSchema,
  taskStatusChangeSchema,
  toFieldErrors,
} from "@/lib/validation";

function failure(message: string, fieldErrors: Record<string, string[] | undefined> = {}): FormState {
  return { status: "error", message, fieldErrors };
}

function success(message: string): FormState {
  return { status: "success", message };
}

/** Turns a thrown value into a user-facing sentence without ever naming `unknown`. */
function describe(error: Error | Prisma.PrismaClientKnownRequestError): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return "That record no longer exists.";
    }
    if (error.code === "P2003") {
      return "Related record is missing.";
    }
    return `Database rejected the write (${error.code}).`;
  }
  return error.message;
}

function reportError(caught: Error | Prisma.PrismaClientKnownRequestError | null): FormState {
  return failure(caught === null ? "Unexpected error." : describe(caught));
}

export async function createProjectAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = projectInputSchema.safeParse({
    name: readField(formData, "name"),
    description: readField(formData, "description"),
    color: readField(formData, "color") || "#6366f1",
  });

  if (!parsed.success) {
    return failure("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    await prisma.project.create({ data: parsed.data });
  } catch (caught) {
    return reportError(caught instanceof Error ? caught : null);
  }

  await invalidateProject(null);
  revalidatePath("/");
  return success(`Project "${parsed.data.name}" created.`);
}

export async function updateProjectAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse({ id: readField(formData, "projectId") });
  const parsed = projectInputSchema.safeParse({
    name: readField(formData, "name"),
    description: readField(formData, "description"),
    color: readField(formData, "color") || "#6366f1",
  });

  if (!id.success) {
    return failure("Missing project id.");
  }
  if (!parsed.success) {
    return failure("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    await prisma.project.update({ where: { id: id.data.id }, data: parsed.data });
  } catch (caught) {
    return reportError(caught instanceof Error ? caught : null);
  }

  await invalidateProject(id.data.id);
  revalidatePath("/");
  revalidatePath(`/projects/${id.data.id}`);
  return success("Project updated.");
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse({ id: readField(formData, "projectId") });

  if (!id.success) {
    return;
  }

  await prisma.project.delete({ where: { id: id.data.id } });
  await invalidateProject(id.data.id);
  revalidatePath("/");
  redirect("/");
}

export async function createTaskAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = taskInputSchema.safeParse({
    projectId: readField(formData, "projectId"),
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    status: readField(formData, "status") || "TODO",
    priority: readField(formData, "priority") || "MEDIUM",
    dueDate: readField(formData, "dueDate"),
  });

  if (!parsed.success) {
    return failure("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const { projectId, ...rest } = parsed.data;

  try {
    await prisma.task.create({ data: { ...rest, project: { connect: { id: projectId } } } });
  } catch (caught) {
    return reportError(caught instanceof Error ? caught : null);
  }

  await invalidateProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return success(`Task "${rest.title}" added.`);
}

export async function updateTaskAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse({ id: readField(formData, "taskId") });
  const parsed = taskInputSchema.safeParse({
    projectId: readField(formData, "projectId"),
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    status: readField(formData, "status") || "TODO",
    priority: readField(formData, "priority") || "MEDIUM",
    dueDate: readField(formData, "dueDate"),
  });

  if (!id.success) {
    return failure("Missing task id.");
  }
  if (!parsed.success) {
    return failure("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const { projectId, ...rest } = parsed.data;

  try {
    await prisma.task.update({ where: { id: id.data.id }, data: rest });
  } catch (caught) {
    return reportError(caught instanceof Error ? caught : null);
  }

  await invalidateProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return success("Task updated.");
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const parsed = taskStatusChangeSchema.safeParse({
    taskId: readField(formData, "taskId"),
    status: readField(formData, "status"),
  });

  if (!parsed.success) {
    return;
  }

  const task = await prisma.task.update({
    where: { id: parsed.data.taskId },
    data: { status: parsed.data.status },
    select: { projectId: true },
  });

  await invalidateProject(task.projectId);
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse({ id: readField(formData, "taskId") });

  if (!id.success) {
    return;
  }

  const task = await prisma.task.delete({
    where: { id: id.data.id },
    select: { projectId: true },
  });

  await invalidateProject(task.projectId);
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
}
