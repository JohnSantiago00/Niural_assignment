const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const allowedExtensions = new Set(["pdf", "docx"]);

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

export function isSupportedResumeFile(fileName: string, fileType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  return Boolean(
    extension &&
      allowedExtensions.has(extension) &&
      (fileType === "" || allowedMimeTypes.has(fileType))
  );
}

export function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
}

