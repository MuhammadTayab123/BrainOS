import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ChatMessageMarkdown,
  isSafeUrl,
  CodeBlock,
  renderPrismTokens,
} from "./chat-message-markdown";
import Prism from "prismjs";

describe("isSafeUrl", () => {
  it("allows standard http and https URLs", () => {
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("https://brainos.local/docs?q=1")).toBe(true);
  });

  it("allows mailto URLs", () => {
    expect(isSafeUrl("mailto:support@brainos.ai")).toBe(true);
  });

  it("allows relative paths and anchor fragments", () => {
    expect(isSafeUrl("/dashboard/tasks")).toBe(true);
    expect(isSafeUrl("/api/v1/conversations")).toBe(true);
    expect(isSafeUrl("#section-1")).toBe(true);
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(isSafeUrl("//evil.com")).toBe(false);
    expect(isSafeUrl("//attacker.org/malware")).toBe(false);
    expect(isSafeUrl("///local/file")).toBe(false);
  });

  it("rejects dangerous javascript: schemes", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeUrl("javascript:void(0)")).toBe(false);
  });

  it("rejects dangerous data: schemes", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("data:image/svg+xml;base64,PHN2Z...")).toBe(false);
  });

  it("rejects vbscript: and file: schemes", () => {
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects null, undefined, empty, or whitespace strings", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("   ")).toBe(false);
    expect(isSafeUrl(null as unknown as string)).toBe(false);
    expect(isSafeUrl(undefined as unknown as string)).toBe(false);
  });
});

describe("renderPrismTokens (Pure React Node Tokenizer)", () => {
  it("renders plain strings as strings", () => {
    const nodes = renderPrismTokens(["hello", " world"]);
    expect(nodes).toEqual(["hello", " world"]);
  });

  it("renders Prism.Token as structured React <span> elements without dangerouslySetInnerHTML", () => {
    const token = new Prism.Token("keyword", "const");
    const nodes = renderPrismTokens([token]);
    const html = renderToStaticMarkup(<>{nodes}</>);

    expect(html).toBe('<span class="token keyword">const</span>');
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("handles nested tokens and aliases properly", () => {
    const inner = new Prism.Token("punctuation", "(");
    const outer = new Prism.Token("function", [inner], "custom-fn");
    const nodes = renderPrismTokens([outer]);
    const html = renderToStaticMarkup(<>{nodes}</>);

    expect(html).toContain('class="token function custom-fn"');
    expect(html).toContain('class="token punctuation"');
    expect(html).toContain("(");
  });
});

describe("ChatMessageMarkdown Component (Static HTML Rendering)", () => {
  it("renders empty string for empty content", () => {
    const html = renderToStaticMarkup(<ChatMessageMarkdown content="" />);
    expect(html).toBe("");
  });

  it("renders basic Markdown paragraphs, bold, italic, and strikethrough", () => {
    const content = "Hello **BrainOS** with *italic* and ~~deleted~~ text.";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).toContain("<strong>BrainOS</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<del>deleted</del>");
  });

  it("renders headings properly with semantic tags", () => {
    const content = "# Heading 1\n## Heading 2\n### Heading 3";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).toContain("<h1");
    expect(html).toContain("Heading 1</h1>");
    expect(html).toContain("<h2");
    expect(html).toContain("Heading 2</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain("Heading 3</h3>");
  });

  it("renders unordered and ordered lists", () => {
    const content = "- Item Alpha\n- Item Beta\n\n1. First Step\n2. Second Step";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).toContain("<ul");
    expect(html).toContain("Item Alpha</li>");
    expect(html).toContain("Item Beta</li>");
    expect(html).toContain("<ol");
    expect(html).toContain("First Step</li>");
    expect(html).toContain("Second Step</li>");
  });

  it("renders blockquotes with custom styling", () => {
    const content = "> This is a critical security advisory.";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).toContain("<blockquote");
    expect(html).toContain("This is a critical security advisory.");
  });

  it("renders GFM tables with header, rows, and responsive wrappers", () => {
    const tableMarkdown = `
| Tool | Status | Risk |
| :--- | :--- | :--- |
| computer_launch | Allowed | ACTION |
| computer_read | Allowed | READ_ONLY |
`;
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={tableMarkdown} />);

    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("computer_launch</td>");
    expect(html).toContain("READ_ONLY</td>");
  });

  it("renders inline code pills", () => {
    const content = "Run `npm run dev` to start.";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).toContain("<code");
    expect(html).toContain("npm run dev</code>");
    expect(html).toContain("bg-zinc-800");
  });

  it("renders safe external links with target=_blank and rel=noopener noreferrer", () => {
    const content = "Visit [BrainOS Documentation](https://brainos.local/docs).";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).toContain('href="https://brainos.local/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("BrainOS Documentation</a>");
  });

  it("disarms dangerous javascript: links into safe inert spans", () => {
    const content = "Click [Exploit Link](javascript:alert('XSS')).";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    // Must NOT render as a clickable <a> tag with href
    expect(html).not.toContain("<a");
    expect(html).not.toContain("javascript:alert");
    expect(html).toContain("<span");
    expect(html).toContain("Exploit Link</span>");
    expect(html).toContain('title="Untrusted link disarmed"');
  });

  it("disarms protocol-relative links (//evil.com)", () => {
    const content = "Click [External Site](//evil.com/phish).";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).not.toContain("<a");
    expect(html).not.toContain("//evil.com");
    expect(html).toContain("External Site</span>");
  });

  it("disarms data: protocol links", () => {
    const content = "Click [Data Link](data:text/html,<script>alert(1)</script>).";
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={content} />);

    expect(html).not.toContain("<a");
    expect(html).not.toContain("data:text/html");
    expect(html).toContain("Data Link</span>");
  });

  it("escapes raw HTML tags to prevent XSS attacks", () => {
    const xssContent = `<script>alert('xss')</script><img src="x" onerror="alert(1)" />`;
    const html = renderToStaticMarkup(<ChatMessageMarkdown content={xssContent} />);

    // Script or img executable tags must NOT be present in DOM
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("gracefully handles incomplete Markdown during streaming", () => {
    // Incomplete code fence without closing ticks
    const streamingCode = "```typescript\nconst x = 42;\n";
    const htmlCode = renderToStaticMarkup(<ChatMessageMarkdown content={streamingCode} />);

    expect(htmlCode).toContain("language-typescript");
    expect(htmlCode).toContain("42");

    // Incomplete bold
    const streamingBold = "Generating **important update";
    const htmlBold = renderToStaticMarkup(<ChatMessageMarkdown content={streamingBold} />);
    expect(htmlBold).toContain("Generating");
    expect(htmlBold).toContain("important update");
  });
});

describe("CodeBlock Component (Syntax Highlighting & Structure)", () => {
  it("renders language label and syntax-highlighted code", () => {
    const code = "const message: string = 'Hello BrainOS';";
    const html = renderToStaticMarkup(<CodeBlock language="typescript" value={code} />);

    expect(html).toContain("typescript");
    expect(html).toContain("Copy");
    expect(html).toContain("language-typescript");
  });

  it("defaults to 'code' label when language is omitted", () => {
    const html = renderToStaticMarkup(<CodeBlock value="echo 'no language tag'" />);
    expect(html).toContain("code");
  });

  it("highlights Python syntax correctly", () => {
    const pythonCode = "def greet(name):\n    return f'Hello {name}'";
    const html = renderToStaticMarkup(<CodeBlock language="python" value={pythonCode} />);

    expect(html).toContain("python");
    expect(html).toContain("token keyword");
  });

  it("handles unknown languages gracefully without throwing", () => {
    const customCode = "custom format syntax";
    const html = renderToStaticMarkup(<CodeBlock language="unknownlang123" value={customCode} />);

    expect(html).toContain("unknownlang123");
    expect(html).toContain("custom format syntax");
  });
});
