import { AwsClient } from "aws4fetch";
import { storageEnv } from "@/lib/env";
import type { StorageEnv } from "@/lib/env";
import { EXTENSION_BY_TYPE, safeFilename } from "@/lib/uploads";

/**
 * Railway Storage Buckets over their S3-compatible API.
 *
 * Uploads come in through `POST /api/tasks/[taskId]/attachments` and are pushed
 * from here, so the browser never talks to the bucket and no CORS rule is
 * needed. Railway buckets are private and have no public URLs, so reads are
 * short-lived presigned GET URLs handed out by `/api/attachments/[id]`.
 *
 * `aws4fetch` signs the requests — SigV4 over `fetch` is all this needs, and it
 * keeps the install to one dependency. Any other S3-compatible bucket (MinIO,
 * Garage, R2, S3 itself) works by pointing STORAGE_ENDPOINT at it.
 */

const GET_URL_TTL_SECONDS = 300;
const PUT_URL_TTL_SECONDS = 300;

export type StorageClient = {
  signer: AwsClient;
  config: StorageEnv;
};

/** `null` when no bucket is configured — every caller degrades instead of throwing. */
export function getStorage(): StorageClient | null {
  if (storageEnv === null) {
    return null;
  }

  return {
    signer: new AwsClient({
      accessKeyId: storageEnv.accessKeyId,
      secretAccessKey: storageEnv.secretAccessKey,
      service: "s3",
      region: storageEnv.region,
    }),
    config: storageEnv,
  };
}

export function isStorageConfigured(): boolean {
  return storageEnv !== null;
}

/**
 * Railway hands out virtual-hosted-style buckets (`https://<bucket>.<host>/<key>`).
 * Buckets made before that change, and most self-hosted S3 servers, need the
 * bucket in the path instead — `STORAGE_FORCE_PATH_STYLE=true` switches to it.
 */
function objectUrl(config: StorageEnv, key: string): string {
  const endpoint = new URL(config.endpoint);
  const path = key.split("/").map(encodeURIComponent).join("/");

  if (config.forcePathStyle) {
    return `${endpoint.origin}/${encodeURIComponent(config.bucket)}/${path}`;
  }

  return `${endpoint.protocol}//${config.bucket}.${endpoint.host}/${path}`;
}

/**
 * Object key for a new upload. The random segment means two uploads of the same
 * filename never collide, and the `tasks/<taskId>/` prefix keeps one task's
 * images together.
 */
export function buildObjectKey(taskId: string, filename: string, contentType: string): string {
  const random = crypto.randomUUID();
  const safe = safeFilename(filename);
  const hasExtension = /\.[a-zA-Z0-9]{2,5}$/.test(safe);
  const extension = EXTENSION_BY_TYPE[contentType] ?? "bin";
  const name = hasExtension ? safe : `${safe}.${extension}`;
  return `tasks/${taskId}/${random}-${name}`;
}

/** Query-signed URL for one object. Only `host` is signed, so other headers stay free. */
async function presign(
  client: StorageClient,
  key: string,
  method: "PUT" | "GET",
  ttlSeconds: number,
  extraQuery: Record<string, string> = {},
): Promise<string> {
  const url = new URL(objectUrl(client.config, key));
  url.searchParams.set("X-Amz-Expires", String(ttlSeconds));

  for (const [name, value] of Object.entries(extraQuery)) {
    url.searchParams.set(name, value);
  }

  const signed = await client.signer.sign(url.toString(), {
    method,
    aws: { signQuery: true },
  });

  return signed.url;
}

/**
 * Sends the bytes to the bucket. Throws with the bucket's own message on failure.
 *
 * The URL is query-signed and then handed to plain `fetch` with the buffer,
 * rather than going through `signer.fetch`. Next.js patches global `fetch`, and
 * its patch rebuilds a `Request` input from `request.body` — a ReadableStream,
 * whose length is unknown, so the request goes out chunked and the bucket
 * answers `411 MissingContentLength`. Passing the buffer through `init` keeps
 * the length, and therefore the `Content-Length` header.
 */
export async function putObject(
  client: StorageClient,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const signedUrl = await presign(client, key, "PUT", PUT_URL_TTL_SECONDS);

  const response = await fetch(signedUrl, {
    method: "PUT",
    body,
    headers: {
      "content-type": contentType,
      "content-length": String(body.byteLength),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Storage rejected the upload (HTTP ${response.status}): ${detail.slice(0, 200)}`);
  }
}

/** Short-lived read URL. `downloadAs` turns the response into a file download. */
export function presignDownload(
  client: StorageClient,
  key: string,
  downloadAs?: string,
): Promise<string> {
  const query: Record<string, string> = {};

  if (downloadAs !== undefined) {
    query["response-content-disposition"] =
      `attachment; filename="${safeFilename(downloadAs)}"`;
  }

  return presign(client, key, "GET", GET_URL_TTL_SECONDS, query);
}

/** Best-effort delete; a failure here leaves an orphan object, never a broken page. */
export async function deleteObject(client: StorageClient, key: string): Promise<void> {
  try {
    await client.signer.fetch(objectUrl(client.config, key), { method: "DELETE" });
  } catch (caught) {
    console.warn(
      `[storage] delete failed for ${key}: ${caught instanceof Error ? caught.message : "unknown"}`,
    );
  }
}

/** Deletes many keys without letting one failure stop the rest. */
export async function deleteObjects(keys: string[]): Promise<void> {
  const client = getStorage();

  if (client === null || keys.length === 0) {
    return;
  }

  await Promise.all(keys.map((key) => deleteObject(client, key)));
}
