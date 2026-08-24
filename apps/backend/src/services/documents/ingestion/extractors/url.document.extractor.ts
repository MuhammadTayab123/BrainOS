export interface UrlDocumentExtractor {
  extract(url: string): Promise<string>;
}
