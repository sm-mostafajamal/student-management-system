import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_EXTENSIONS = ["pdf", "docx"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

const MIME_BY_EXTENSION: Record<AllowedExtension, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export class FileValidationError extends Error {}

/**
 * Detects file type from actual bytes (magic numbers), never from the
 * client-supplied Content-Type or filename extension — both are trivially
 * spoofable (rename malware.exe to report.pdf, or send a fake mimetype).
 */
function detectSignature(buffer: Buffer): AllowedExtension | null {
  if (buffer.length < 4) return null;

  const asciiHeader = buffer.subarray(0, 5).toString("latin1");
  if (asciiHeader.startsWith("%PDF-")) return "pdf";

  // DOCX (OOXML) is a ZIP container — local file header signature PK\x03\x04
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return "docx";
  }
  return null;
}

function getClaimedExtension(filename: string): string {
  return path.extname(filename).replace(".", "").toLowerCase();
}

export interface ValidatedFile {
  buffer: Buffer;
  extension: AllowedExtension;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Pure, synchronous validation — no disk or DB access. Runs BEFORE we
 * write anything or open a transaction, so a bad file fails fast and
 * cheaply.
 */
export function validateSubmissionFile(
  buffer: Buffer,
  originalFileName: string
): ValidatedFile {
  if (buffer.length === 0) {
    throw new FileValidationError("The uploaded file is empty.");
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError(
      `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
    );
  }

  const claimedExt = getClaimedExtension(originalFileName);
  if (!ALLOWED_EXTENSIONS.includes(claimedExt as AllowedExtension)) {
    throw new FileValidationError("Only PDF and DOCX files are accepted.");
  }

  const detectedExt = detectSignature(buffer);
  if (!detectedExt) {
    throw new FileValidationError(
      "The file's contents do not match a supported PDF or DOCX format."
    );
  }
  if (detectedExt !== claimedExt) {
    throw new FileValidationError(
      "The file extension does not match the file's actual content."
    );
  }

  return {
    buffer,
    extension: detectedExt,
    mimeType: MIME_BY_EXTENSION[detectedExt],
    sizeBytes: buffer.length,
  };
}

/**
 * Persists a validated file under a server-generated path. The original
 * filename is NEVER used to build the storage path — only assessmentId,
 * studentId (both server-controlled cuids) and a random UUID are. This is
 * what blocks path traversal (`../../etc/passwd`) and overwrite attacks via
 * a crafted filename.
 */
export async function saveSubmissionFile(
  assessmentId: string,
  studentId: string,
  file: ValidatedFile
): Promise<string> {
  const dir = path.resolve(
    path.join(UPLOADS_ROOT, "assessments", assessmentId, studentId)
  );
  if (!dir.startsWith(path.resolve(UPLOADS_ROOT))) {
    // Unreachable in practice (ids are cuids), kept as defense in depth.
    throw new Error("Resolved storage path escaped the uploads root.");
  }
  await mkdir(dir, { recursive: true });

  const storedFileName = `${randomUUID()}.${file.extension}`;
  const absolutePath = path.join(dir, storedFileName);
  await writeFile(absolutePath, file.buffer);

  // Stored as a relative KEY (not a URL) — resolved back to an absolute
  // path only inside getAuthorizedSubmissionFile(), after an auth check.
  return path.relative(UPLOADS_ROOT, absolutePath);
}

export async function deleteSubmissionFile(storageKey: string): Promise<void> {
  try {
    const absolutePath = resolveStoragePath(storageKey);
    await unlink(absolutePath);
  } catch {
    // Best-effort cleanup of an orphaned file after a failed transaction —
    // "file already gone" is not itself an error worth surfacing.
  }
}

export function resolveStoragePath(storageKey: string): string {
  const absolutePath = path.resolve(path.join(UPLOADS_ROOT, storageKey));
  if (!absolutePath.startsWith(path.resolve(UPLOADS_ROOT))) {
    throw new Error("Invalid storage key.");
  }
  return absolutePath;
}