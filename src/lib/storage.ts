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

/** Sends the bytes to the bucket. Throws with the bucket's own message on failure. */
export async function putObject(
  client: StorageClient,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const response = await client.signer.fetch(objectUrl(client.config, key), {
    method: "PUT",
    body,
    headers: { "content-type": contentType },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Storage rejected the upload (HTTP ${response.status}): ${detail.slice(0, 200)}`);
  }
}

/** Short-lived read URL. `downloadAs` turns the response into a file download. */
export async function presignDownload(
  client: StorageClient,
  key: string,
  downloadAs?: string,
): Promise<string> {
  const url = new URL(objectUrl(client.config, key));
  url.searchParams.set("X-Amz-Expires", String(GET_URL_TTL_SECONDS));

  if (downloadAs !== undefined) {
    url.searchParams.set(
      "response-content-disposition",
      `attachment; filename="${safeFilename(downloadAs)}"`,
    );
  }

  const signed = await client.signer.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });

  return signed.url;
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
