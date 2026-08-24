import {
  ChunkDocumentInput,
  DocumentChunk,
} from "./document.chunker.types";

const DEFAULT_MAX_CHARACTERS = 1200;
const DEFAULT_OVERLAP_CHARACTERS = 150;
const MIN_BOUNDARY_RATIO = 0.5;

export class DocumentChunker {
  chunk(
    input: ChunkDocumentInput,
  ): DocumentChunk[] {
    const content = input.content.trim();

    if (!content) {
      throw new Error(
        "Document content is required for chunking.",
      );
    }

    const maxCharacters =
      input.maxCharacters ??
      DEFAULT_MAX_CHARACTERS;

    const overlapCharacters =
      input.overlapCharacters ??
      DEFAULT_OVERLAP_CHARACTERS;

    if (
      !Number.isInteger(maxCharacters) ||
      maxCharacters < 1
    ) {
      throw new Error(
        "Chunk size must be a positive integer.",
      );
    }

    if (
      !Number.isInteger(overlapCharacters) ||
      overlapCharacters < 0
    ) {
      throw new Error(
        "Chunk overlap must be a non-negative integer.",
      );
    }

    if (
      overlapCharacters >= maxCharacters
    ) {
      throw new Error(
        "Chunk overlap must be smaller than chunk size.",
      );
    }

    const chunks: DocumentChunk[] = [];
    let start = 0;

    while (start < content.length) {
      const maxEnd = Math.min(
        start + maxCharacters,
        content.length,
      );

      const end =
        maxEnd >= content.length
          ? content.length
          : this.findPreferredBoundary(
              content,
              start,
              maxEnd,
            );

      chunks.push({
        index: chunks.length,
        content: content
          .slice(start, end)
          .trim(),
      });

      if (end >= content.length) {
        break;
      }

      start = end - overlapCharacters;
    }

    return chunks;
  }

  private findPreferredBoundary(
    content: string,
    start: number,
    maxEnd: number,
  ): number {
    const minimumBoundary =
      start +
      Math.floor(
        (maxEnd - start) *
          MIN_BOUNDARY_RATIO,
      );

    const paragraphBoundary =
      content.lastIndexOf("\n", maxEnd);

    if (
      paragraphBoundary >= minimumBoundary
    ) {
      return paragraphBoundary;
    }

    const sentenceMatch = content
      .slice(start, maxEnd)
      .match(/[\.\!\?](?:["'”’)]*)?(?=\s|$)/g);

    if (sentenceMatch?.length) {
      const lastMatch =
        sentenceMatch[sentenceMatch.length - 1];

      const relativeIndex =
        content
          .slice(start, maxEnd)
          .lastIndexOf(lastMatch);

      const sentenceBoundary =
        start +
        relativeIndex +
        lastMatch.length;

      if (
        sentenceBoundary >= minimumBoundary
      ) {
        return sentenceBoundary;
      }
    }

    return maxEnd;
  }
}