export interface DocumentChunk {
  index: number;
  content: string;
}

export interface ChunkDocumentInput {
  content: string;
  maxCharacters?: number;
  overlapCharacters?: number;
}
