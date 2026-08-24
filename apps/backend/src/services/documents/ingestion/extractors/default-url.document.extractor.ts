export class DefaultUrlDocumentExtractor {
  async extract(url: string): Promise<string> {
    const normalizedUrl = this.validateUrl(url);

    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: "text/html, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "BrainOS/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `URL document extraction failed with HTTP ${response.status}.`,
      );
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    const body = await response.text();

    if (!body.trim()) {
      throw new Error(
        "URL document extraction returned empty content.",
      );
    }

    if (contentType.includes("text/plain")) {
      return body.trim();
    }

    if (contentType.includes("text/html")) {
      return this.extractHtmlText(body);
    }

    throw new Error(
      `Unsupported URL content type: ${contentType || "unknown"}.`,
    );
  }

  private validateUrl(url: string): string {
    if (!url || url.trim().length === 0) {
      throw new Error(
        "URL document source is required.",
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(url.trim());
    } catch {
      throw new Error(
        "URL document source must be a valid URL.",
      );
    }

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error(
        "URL document source must use HTTP or HTTPS.",
      );
    }

    return parsed.toString();
  }

  private extractHtmlText(html: string): string {
    const withoutHead = html.replace(
      /<head\b[^>]*>[\s\S]*?<\/head>/gi,
      " ",
    );

    const withoutScripts = withoutHead
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " ",
      );

    return withoutScripts
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();
  }
}