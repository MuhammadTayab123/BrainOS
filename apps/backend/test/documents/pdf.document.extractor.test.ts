import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DefaultPdfDocumentExtractor } from "../../src/services/documents/ingestion/extractors/default-pdf.document.extractor";

describe("DefaultPdfDocumentExtractor", () => {
  const extractor = new DefaultPdfDocumentExtractor();

  it("rejects an empty PDF buffer", async () => {
    await expect(
      extractor.extract(Buffer.alloc(0)),
    ).rejects.toThrow(
      "PDF document buffer is required.",
    );
  });

  it("rejects non-buffer input", async () => {
    await expect(
      extractor.extract("not-a-buffer" as any),
    ).rejects.toThrow(
      "PDF document buffer is required.",
    );
  });

  it("extracts text from a real PDF fixture", async () => {
    const pdfPath = join(
      process.cwd(),
      "test",
      "fixtures",
      "document-sample.pdf",
    );

    const buffer = await readFile(pdfPath);

    const result =
      await extractor.extract(buffer);

    expect(result).toContain("BrainOS");
  });
});