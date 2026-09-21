"use client";

import { useFormStatus } from "react-dom";
import type { FieldErrors, FormState } from "@/lib/types";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({
  label,
  pendingLabel = "Saving…",
  className = "btn-primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FieldError({
  errors,
  name,
}: {
  errors: FieldErrors;
  name: string;
}) {
  const messages = errors[name];

  if (messages === undefined || messages.length === 0) {
    return null;
  }

  return <p className="mt-1 text-xs text-rose-400">{messages[0]}</p>;
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle") {
    return null;
  }

  const tone =
    state.status === "success"
      ? "border-emerald-900 bg-emerald-950/50 text-emerald-300"
      : "border-rose-900 bg-rose-950/50 text-rose-300";

  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`} role="status">
      {state.message}
    </p>
  );
}

export function fieldErrorsOf(state: FormState): FieldErrors {
  return state.status === "error" ? state.fieldErrors : {};
}
