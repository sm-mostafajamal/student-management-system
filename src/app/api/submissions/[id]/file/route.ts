import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { getSessionUser } from "@/lib/session";
import { getAuthorizedSubmissionFile } from "@/services/submission.service";
import { DomainError } from "@/lib/errors";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n"]/g, "");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const file = await getAuthorizedSubmissionFile(id, user);
    const stats = await stat(file.absolutePath);
    const webStream = Readable.toWeb(
      createReadStream(file.absolutePath)
    ) as ReadableStream<Uint8Array>;

    const safeName = sanitizeHeaderValue(file.originalFileName);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(stats.size),
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(
          file.originalFileName
        )}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof DomainError) {
      const status = err.code === "FORBIDDEN" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("submission file download failed", err);
    return NextResponse.json({ error: "Failed to retrieve file." }, { status: 500 });
  }
}