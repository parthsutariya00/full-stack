import { NextResponse } from "next/server";
import { notFoundResponse, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getStorage, presignDownload } from "@/lib/storage";
import type { ApiError } from "@/lib/types";

/**
 * Serves one image out of the bucket.
 *
 * Railway buckets are private and have no public URLs: this route looks the row up, mints a
 * five-minute presigned GET URL and redirects to it, so a link that leaks stops
 * working on its own. `?download=1` turns the response into a file download.
 */

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ attachmentId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError> | Response> {
  const { attachmentId } = await context.params;
  const client = getStorage();

  if (client === null) {
    return NextResponse.json<ApiError>(
      { error: "Image storage is not configured" },
      { status: 503 },
    );
  }

  try {
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: { key: true, filename: true },
    });

    if (attachment === null) {
      return notFoundResponse("Image not found");
    }

    const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
    const signed = await presignDownload(
      client,
      attachment.key,
      wantsDownload ? attachment.filename : undefined,
    );

    // Private: the signed URL is per-request, so no shared cache may keep it.
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (caught) {
    return serverError(caught instanceof Error ? caught : null);
  }
}
