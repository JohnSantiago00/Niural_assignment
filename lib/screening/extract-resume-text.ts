/**
 * Converts uploaded resumes into plain text for screening. This is intentionally
 * pragmatic: PDF and DOCX are supported because they cover the assignment
 * requirements and the vast majority of prototype resumes.
 */
import { createRequire } from "node:module";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);

function normalizeExtractedText(text: string) {
  return text.replace(/\u0000/g, "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extracts text based on the stored file extension. DOCX extraction tends to be
 * more reliable than PDF extraction for layout-heavy resumes, which is an MVP
 * limitation documented in the Phase C notes.
 */
export async function extractResumeText(filePath: string, fileBlob: Blob) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

  if (extension === "pdf") {
    // Loading the internal parser implementation avoids the package wrapper's
    // standalone debug path, which tries to open the library's sample PDF.
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      dataBuffer: Buffer | Uint8Array
    ) => Promise<{ text: string }>;
    const result = await pdfParse(fileBuffer);
    const text = normalizeExtractedText(result.text);

    if (!text) {
      throw new Error("The PDF resume could not be parsed into readable text.");
    }

    return text;
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text = normalizeExtractedText(result.value);

    if (!text) {
      throw new Error("The DOCX resume could not be parsed into readable text.");
    }

    return text;
  }

  throw new Error("Only PDF and DOCX resumes are supported for AI screening.");
}
