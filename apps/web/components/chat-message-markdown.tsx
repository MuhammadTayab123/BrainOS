"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";

// Load common language grammars into Prism
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-css";

/**
 * Validates whether a URL protocol is safe for link navigation.
 * Only http:, https:, mailto:, and safe relative paths (/path, #fragment) are allowed.
 * Strictly blocks protocol-relative URLs (//evil.com) and dangerous schemes (javascript:, data:, etc.).
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  const trimmed = url.trim();

  // Reject protocol-relative URLs (e.g. //attacker.com)
  if (trimmed.startsWith("//")) {
    return false;
  }

  // Allow anchor fragments and root-relative paths
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) {
      return true;
    }
    return false;
  }
}

/**
 * Renders Prism tokens recursively into pure React elements without dangerouslySetInnerHTML.
 */
export function renderPrismTokens(
  tokens: Array<string | Prism.Token>,
  keyPrefix = "token",
): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (typeof token === "string") {
      return token;
    }

    const classNames = ["token", token.type];
    if (token.alias) {
      if (Array.isArray(token.alias)) {
        classNames.push(...token.alias);
      } else {
        classNames.push(token.alias);
      }
    }

    let children: React.ReactNode;
    if (Array.isArray(token.content)) {
      children = renderPrismTokens(token.content, key);
    } else if (typeof token.content === "object" && token.content !== null) {
      children = renderPrismTokens([token.content as Prism.Token], key);
    } else {
      children = String(token.content);
    }

    return (
      <span key={key} className={classNames.join(" ")}>
        {children}
      </span>
    );
  });
}

/**
 * Single code block component with syntax highlighting and copy-to-clipboard button.
 */
export function CodeBlock({
  language,
  value,
}: {
  language?: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const cleanLang = language ? language.toLowerCase().trim() : "";
  const displayLang = cleanLang || "code";

  let tokenNodes: React.ReactNode | null = null;
  if (cleanLang && Prism.languages[cleanLang]) {
    try {
      const tokens = Prism.tokenize(value, Prism.languages[cleanLang]);
      tokenNodes = renderPrismTokens(tokens);
    } catch {
      tokenNodes = null;
    }
  }

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback or ignore clipboard errors
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 font-mono text-xs shadow-md">
      {/* Code Block Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/70 bg-zinc-900/90 px-3.5 py-1.5 text-zinc-400">
        <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
          {displayLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied to clipboard" : "Copy code"}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          {copied ? (
            <>
              <svg
                className="h-3.5 w-3.5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Block Body */}
      <div className="overflow-x-auto p-3.5 text-zinc-100 leading-relaxed">
        {tokenNodes ? (
          <pre className="!bg-transparent !p-0 !m-0">
            <code className={`language-${cleanLang}`}>{tokenNodes}</code>
          </pre>
        ) : (
          <pre className="!bg-transparent !p-0 !m-0">
            <code>{value}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

export interface ChatMessageMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Safely renders markdown content for assistant messages and streaming tokens.
 * Enforces strict XSS prevention, safe link handling, and GFM features.
 */
export function ChatMessageMarkdown({
  content,
  className = "",
}: ChatMessageMarkdownProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={`prose prose-invert max-w-none text-sm md:text-base leading-relaxed break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom Pre rendering to avoid double pre wrappers
          pre: ({ children }) => <>{children}</>,

          // Custom Code / Pre rendering
          code({ node, className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const isInline = !match && !String(children).includes("\n") && !node?.position?.start.line;

            // Fenced multi-line or tagged code block
            if (match || String(children).includes("\n")) {
              const codeString = String(children).replace(/\n$/, "");
              return (
                <CodeBlock
                  language={match ? match[1] : undefined}
                  value={codeString}
                />
              );
            }

            // Inline code pill
            return (
              <code
                className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[0.875em] text-emerald-300 border border-zinc-700/50"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Safe Link rendering
          a({ href, children }) {
            const rawHref = href || "";
            if (!isSafeUrl(rawHref)) {
              // Disarm dangerous schemes (e.g. javascript:, data:, //evil.com) by rendering as safe inert text
              return (
                <span className="text-zinc-400 underline decoration-dotted" title="Untrusted link disarmed">
                  {children}
                </span>
              );
            }

            const isExternal = rawHref.startsWith("http://") || rawHref.startsWith("https://");

            return (
              <a
                href={rawHref}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="font-medium text-blue-400 underline underline-offset-2 hover:text-blue-300 transition"
              >
                {children}
              </a>
            );
          },

          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg md:text-xl font-bold text-zinc-50 mt-4 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base md:text-lg font-semibold text-zinc-100 mt-3 mb-2 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm md:text-base font-semibold text-zinc-200 mt-2 mb-1.5 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium text-zinc-200 mt-2 mb-1">
              {children}
            </h4>
          ),

          // Paragraphs & Lists
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2.5 pl-1">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-200 leading-normal">{children}</li>,

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-2 border-blue-500/70 bg-blue-950/20 pl-3.5 py-1.5 text-zinc-300 italic rounded-r-md">
              {children}
            </blockquote>
          ),

          // GFM Tables
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-800 text-left text-xs md:text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-zinc-900/90 text-zinc-200 font-semibold">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/50">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-zinc-900/40 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-3.5 py-2.5 text-zinc-200 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-3.5 py-2 text-zinc-300">{children}</td>,

          // Horizontal rule
          hr: () => <hr className="my-3 border-zinc-800" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
