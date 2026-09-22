/**
 * Upload rules shared by the browser and the server. The client checks them to
 * fail fast; the server checks them again because a client can lie.
 *
 * Kept free of any R2 or environment import so it is safe in a client bundle.
 */

/** Anything larger is rejected before an upload URL is ever handed out. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];

/** `accept` value for the file input, kept in step with the list above. */
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

export const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType);
}

/** Strips directory parts and anything awkward in a URL or a header. */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "image";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-{2,}/g, "-");
  return cleaned.length > 0 && cleaned !== "." ? cleaned.slice(0, 120) : "image";
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
