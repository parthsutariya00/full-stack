"use client";

import type { FormEvent } from "react";
import { deleteProjectAction } from "@/lib/actions";
import { SubmitButton } from "@/components/form-parts";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
};

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  function confirmDelete(event: FormEvent<HTMLFormElement>): void {
    const message = `Delete "${projectName}" and all of its tasks? This cannot be undone.`;
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteProjectAction} onSubmit={confirmDelete}>
      <input type="hidden" name="projectId" value={projectId} />
      <SubmitButton label="Delete" pendingLabel="Deleting…" className="btn-danger" />
    </form>
  );
}
