import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ApiError, FieldErrors, JsonValue } from "@/lib/types";

/** Parses a JSON request body, returning `null` when the body is absent or malformed. */
export async function readJsonBody(request: Request): Promise<JsonValue | null> {
  try {
    const body: JsonValue = await request.json();
    return body;
  } catch {
    return null;
  }
}

export function badRequest(message: string, fieldErrors?: FieldErrors): NextResponse<ApiError> {
  return NextResponse.json<ApiError>({ error: message, fieldErrors }, { status: 400 });
}

export function notFoundResponse(message: string): NextResponse<ApiError> {
  return NextResponse.json<ApiError>({ error: message }, { status: 404 });
}

/** Maps a thrown value to an HTTP response without ever typing it as `unknown`. */
export function serverError(caught: Error | null): NextResponse<ApiError> {
  if (caught instanceof Prisma.PrismaClientKnownRequestError) {
    if (caught.code === "P2025") {
      return notFoundResponse("Record not found");
    }
    return NextResponse.json<ApiError>(
      { error: `Database error ${caught.code}` },
      { status: 409 },
    );
  }

  return NextResponse.json<ApiError>(
    { error: caught === null ? "Unexpected server error" : caught.message },
    { status: 500 },
  );
}
