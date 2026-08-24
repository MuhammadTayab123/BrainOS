import { DocumentChunker } from "../chunking/document.chunker";
import { DocumentChunk } from "../chunking/document.chunker.types";

export interface ProcessDocumentInput {
  content: string;
  maxCharacters?: number;
  overlapCharacters?: number;
}

export interface ProcessDocumentResult {
  chunks: DocumentChunk[];
}

export class DocumentProcessingService {
  constructor(
    private readonly documentChunker: DocumentChunker =
      new DocumentChunker(),
  ) {}

  process(
    input: ProcessDocumentInput,
  ): ProcessDocumentResult {
    const chunks = this.documentChunker.chunk({
      content: input.content,
      maxCharacters: input.maxCharacters,
      overlapCharacters: input.overlapCharacters,
    });

    return {
      chunks,
    };
  }
}
