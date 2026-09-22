"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { deleteAttachmentAction } from "@/lib/attachment-actions";
import type { ApiError, AttachmentDTO } from "@/lib/types";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  formatBytes,
  isAllowedImageType,
} from "@/lib/uploads";

type TaskAttachmentsProps = {
  taskId: string;
  attachments: AttachmentDTO[];
  /** False when no bucket is configured — the picker is disabled rather than hidden. */
  storageReady: boolean;
};

type PendingUpload = {
  id: string;
  filename: string;
  progress: number;
  error: string | null;
};

/** What `POST /api/tasks/[taskId]/attachments` can answer with. */
type ApiUploadResponse = AttachmentDTO | ApiError | null;

/**
 * POSTs the file to this app, which forwards it to the bucket. XHR rather than
 * fetch, because only XHR reports upload progress.
 */
function uploadToApi(
  taskId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<AttachmentDTO> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);

    xhr.open("POST", `/api/tasks/${taskId}/attachments`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event: ProgressEvent): void => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = (): void => {
      const payload: ApiUploadResponse = xhr.response;

      if (xhr.status >= 200 && xhr.status < 300 && payload !== null && "id" in payload) {
        resolve(payload);
        return;
      }

      reject(
        new Error(
          payload !== null && "error" in payload
            ? payload.error
            : `Upload failed (HTTP ${xhr.status}).`,
        ),
      );
    };

    xhr.onerror = (): void => {
      reject(new Error("Network error while uploading."));
    };

    xhr.send(body);
  });
}

export function TaskAttachments({ taskId, attachments, storageReady }: TaskAttachmentsProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [added, setAdded] = useState<AttachmentDTO[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Freshly confirmed images show immediately; the router refresh folds them
  // into the server data a moment later, and the ids de-duplicate the overlap.
  const visible = useMemo((): AttachmentDTO[] => {
    const serverIds = new Set(attachments.map((item) => item.id));
    return [...attachments, ...added.filter((item) => !serverIds.has(item.id))];
  }, [attachments, added]);

  function updatePending(id: string, patch: Partial<PendingUpload>): void {
    setPending((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function dropPending(id: string): void {
    setPending((current) => current.filter((item) => item.id !== id));
  }

  async function uploadOne(file: File): Promise<void> {
    const id = crypto.randomUUID();
    setPending((current) => [...current, { id, filename: file.name, progress: 0, error: null }]);

    if (!isAllowedImageType(file.type)) {
      updatePending(id, { error: "Only PNG, JPEG, WebP, GIF and AVIF images are allowed." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      updatePending(id, { error: `Image must be ${MAX_IMAGE_MB}MB or smaller.` });
      return;
    }

    try {
      const saved = await uploadToApi(taskId, file, (percent) => {
        updatePending(id, { progress: percent });
      });

      dropPending(id);
      setAdded((current) => [...current, saved]);
      router.refresh();
    } catch (caught) {
      updatePending(id, {
        error: caught instanceof Error ? caught.message : "Upload failed.",
      });
    }
  }

  function handleFiles(files: FileList | null): void {
    if (files === null) {
      return;
    }
    for (const file of Array.from(files)) {
      void uploadOne(file);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    handleFiles(event.currentTarget.files);
    // Reset so picking the same file twice in a row still fires a change event.
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);

    if (storageReady) {
      handleFiles(event.dataTransfer.files);
    }
  }

  function confirmDelete(event: FormEvent<HTMLFormElement>): void {
    if (!window.confirm("Delete this image? This cannot be undone.")) {
      event.preventDefault();
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Images</h2>
        <span className="text-xs text-slate-500">
          {visible.length === 0 ? "None yet" : `${visible.length} attached`}
        </span>
      </div>

      {storageReady ? null : (
        <p className="rounded-lg border border-amber-900 bg-amber-950/50 px-3 py-2 text-sm text-amber-300">
          Image storage is not configured. Set STORAGE_ENDPOINT, STORAGE_BUCKET,
          STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY in <code>.env</code> from your
          Railway bucket&apos;s Credentials tab, then restart the dev server.
        </p>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed px-4 py-6 text-center transition ${
          isDragging ? "border-indigo-500 bg-indigo-950/30" : "border-edge bg-surface"
        } ${storageReady ? "" : "opacity-50"}`}
      >
        <p className="text-sm text-slate-400">Drop images here, or</p>
        <button
          type="button"
          className="btn-ghost mt-2 py-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={!storageReady}
        >
          Choose files
        </button>
        <p className="mt-2 text-xs text-slate-600">
          PNG, JPEG, WebP, GIF or AVIF · up to {MAX_IMAGE_MB}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {pending.length === 0 ? null : (
        <ul className="space-y-2">
          {pending.map((item) => (
            <li key={item.id} className="rounded-lg border border-edge bg-surface px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-300">{item.filename}</span>
                {item.error === null ? (
                  <span className="text-slate-500">{item.progress}%</span>
                ) : (
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-300"
                    onClick={() => dropPending(item.id)}
                  >
                    Dismiss
                  </button>
                )}
              </div>

              {item.error === null ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs text-rose-400">{item.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 ? null : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {visible.map((attachment) => (
            <li
              key={attachment.id}
              className="overflow-hidden rounded-lg border border-edge bg-surface"
            >
              <a
                href={`/api/attachments/${attachment.id}`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the source is a short-lived signed redirect, not an optimisable static asset */}
                <img
                  src={`/api/attachments/${attachment.id}`}
                  alt={attachment.filename}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />
              </a>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-[11px] text-slate-400" title={attachment.filename}>
                  {attachment.filename}
                </span>
                <span className="shrink-0 text-[11px] text-slate-600">
                  {formatBytes(attachment.size)}
                </span>
              </div>
              <form action={deleteAttachmentAction} onSubmit={confirmDelete} className="px-2 pb-2">
                <input type="hidden" name="attachmentId" value={attachment.id} />
                <button type="submit" className="btn-danger w-full py-1 text-[11px]">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
