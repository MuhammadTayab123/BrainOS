import { PDFParse } from "pdf-parse";

export class DefaultPdfDocumentExtractor {
  async extract(buffer: Buffer): Promise<string> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error(
        "PDF document buffer is required.",
      );
    }

    const parser = new PDFParse({
      data: buffer,
    });

    try {
      const result = await parser.getText();
      const content = result.text.trim();

      if (!content) {
        throw new Error(
          "PDF document extraction returned empty content.",
        );
      }

      return content;
    } finally {
      await parser.destroy();
    }
  }
}