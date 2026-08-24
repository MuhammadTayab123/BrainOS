import { afterEach, describe, expect, it, vi } from "vitest";

import { DefaultUrlDocumentExtractor } from "../../src/services/documents/ingestion/extractors/default-url.document.extractor";

describe("DefaultUrlDocumentExtractor", () => {
  const extractor = new DefaultUrlDocumentExtractor();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts and normalizes plain text responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          "  Hello BrainOS\n\nDocument content  ",
          {
            status: 200,
            headers: {
              "content-type": "text/plain",
            },
          },
        ),
      ),
    );

    await expect(
      extractor.extract("https://example.com/document.txt"),
    ).resolves.toBe(
      "Hello BrainOS\n\nDocument content",
    );
  });

  it("extracts readable text from HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `
            <html>
              <head>
                <title>Test</title>
                <script>ignoreThis();</script>
              </head>
              <body>
                <h1>BrainOS</h1>
                <p>Hello world.</p>
                <style>.hidden { display: none; }</style>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          },
        ),
      ),
    );

    await expect(
      extractor.extract("https://example.com"),
    ).resolves.toBe(
      "BrainOS Hello world.",
    );
  });

  it("rejects invalid URLs", async () => {
    await expect(
      extractor.extract("not-a-url"),
    ).rejects.toThrow(
      "URL document source must be a valid URL.",
    );
  });

  it("rejects non-http protocols", async () => {
    await expect(
      extractor.extract("ftp://example.com/file.txt"),
    ).rejects.toThrow(
      "URL document source must use HTTP or HTTPS.",
    );
  });

  it("rejects failed HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Not found", {
          status: 404,
        }),
      ),
    );

    await expect(
      extractor.extract("https://example.com/missing"),
    ).rejects.toThrow(
      "URL document extraction failed with HTTP 404.",
    );
  });

  it("rejects empty responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("   ", {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );

    await expect(
      extractor.extract("https://example.com/empty"),
    ).rejects.toThrow(
      "URL document extraction returned empty content.",
    );
  });

  it("rejects unsupported response content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("binary", {
          status: 200,
          headers: {
            "content-type": "application/pdf",
          },
        }),
      ),
    );

    await expect(
      extractor.extract("https://example.com/file.pdf"),
    ).rejects.toThrow(
      "Unsupported URL content type: application/pdf.",
    );
  });
});
