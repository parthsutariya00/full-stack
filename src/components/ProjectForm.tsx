"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProjectAction, updateProjectAction } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/types";
import type { FormState, ProjectDTO } from "@/lib/types";
import { FieldError, FormMessage, SubmitButton, fieldErrorsOf } from "@/components/form-parts";

type ProjectFormProps = {
  project?: ProjectDTO;
};

export function ProjectForm({ project }: ProjectFormProps) {
  const isEdit = project !== undefined;
  const action = isEdit ? updateProjectAction : createProjectAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, IDLE_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = fieldErrorsOf(state);

  useEffect(() => {
    if (!isEdit && state.status === "success") {
      formRef.current?.reset();
    }
  }, [isEdit, state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">
          {isEdit ? "Edit project" : "New project"}
        </h2>
        <p className="text-sm text-slate-400">
          {isEdit ? "Rename or restyle this project." : "Group related tasks under a project."}
        </p>
      </div>

      {isEdit ? <input type="hidden" name="projectId" value={project.id} /> : null}

      <div>
        <label className="label" htmlFor="project-name">
          Name
        </label>
        <input
          id="project-name"
          name="name"
          className="field"
          defaultValue={project?.name ?? ""}
          placeholder="Website redesign"
          maxLength={80}
          required
        />
        <FieldError errors={errors} name="name" />
      </div>

      <div>
        <label className="label" htmlFor="project-description">
          Description
        </label>
        <textarea
          id="project-description"
          name="description"
          className="field min-h-20 resize-y"
          defaultValue={project?.description ?? ""}
          placeholder="What is this project about?"
          maxLength={500}
        />
        <FieldError errors={errors} name="description" />
      </div>

      <div>
        <label className="label" htmlFor="project-color">
          Accent color
        </label>
        <input
          id="project-color"
          name="color"
          type="color"
          className="h-10 w-20 cursor-pointer rounded-lg border border-edge bg-surface p-1"
          defaultValue={project?.color ?? "#6366f1"}
        />
        <FieldError errors={errors} name="color" />
      </div>

      <FormMessage state={state} />

      <SubmitButton label={isEdit ? "Save changes" : "Create project"} />
    </form>
  );
}
