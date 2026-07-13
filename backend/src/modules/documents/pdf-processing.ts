import type { DocumentConfig } from "./document-config.js";
import type { DocumentChapter } from "./document-repository.js";

const DEFAULT_CHAPTER_TITLE = "Document";
const MAX_CHAPTER_TITLE_LENGTH = 500;

export interface ExtractedPdfPage {
  readonly pageNumber: number;
  readonly text: string;
}

export interface ExtractedPdfDocument {
  readonly pageCount: number;
  readonly pages: readonly ExtractedPdfPage[];
}

export interface IPdfTextExtractor {
  extract(pdf: Uint8Array): Promise<ExtractedPdfDocument>;
}

export interface PlannedDocumentChunk {
  readonly chapterTitle: string | null;
  readonly chunkText: string;
  readonly pageEnd: number;
  readonly pageStart: number;
}

export interface DocumentChunkPlan {
  readonly chapters: readonly DocumentChapter[];
  readonly chunks: readonly PlannedDocumentChunk[];
  readonly pageCount: number;
}

export class EmptyPdfTextError extends Error {
  constructor() {
    super("PDF does not contain extractable text");
    this.name = "EmptyPdfTextError";
  }
}

interface PageToken {
  readonly pageNumber: number;
  readonly value: string;
}

interface DetectedChapterHeading {
  readonly pageNumber: number;
  readonly title: string;
}

export function planDocumentChunks(
  document: ExtractedPdfDocument,
  config: Pick<DocumentConfig, "chunkMaxTokens" | "chunkOverlapTokens">,
): DocumentChunkPlan {
  validateChunkConfig(config);

  if (!Number.isSafeInteger(document.pageCount) || document.pageCount < 1) {
    throw new EmptyPdfTextError();
  }

  const pages = normalizePages(document);
  const tokens = pages.flatMap(tokenizePage);

  if (tokens.length === 0) {
    throw new EmptyPdfTextError();
  }

  const chapters = detectChapters(pages, document.pageCount);
  const chunks = createOverlappingChunks(tokens, chapters, config);

  return {
    chapters,
    chunks,
    pageCount: document.pageCount,
  };
}

function validateChunkConfig(
  config: Pick<DocumentConfig, "chunkMaxTokens" | "chunkOverlapTokens">,
): void {
  if (
    !Number.isSafeInteger(config.chunkMaxTokens) ||
    config.chunkMaxTokens < 1
  ) {
    throw new RangeError("chunkMaxTokens must be a positive integer");
  }

  if (
    !Number.isSafeInteger(config.chunkOverlapTokens) ||
    config.chunkOverlapTokens < 0 ||
    config.chunkOverlapTokens >= config.chunkMaxTokens
  ) {
    throw new RangeError(
      "chunkOverlapTokens must be a non-negative integer smaller than chunkMaxTokens",
    );
  }
}

function normalizePages(
  document: ExtractedPdfDocument,
): readonly ExtractedPdfPage[] {
  return document.pages
    .filter((page) => {
      return (
        Number.isSafeInteger(page.pageNumber) &&
        page.pageNumber >= 1 &&
        page.pageNumber <= document.pageCount
      );
    })
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

function tokenizePage(page: ExtractedPdfPage): readonly PageToken[] {
  return tokenizeText(page.text).map((value) => ({
    pageNumber: page.pageNumber,
    value,
  }));
}

function tokenizeText(text: string): readonly string[] {
  return normalizeExtractedText(text).match(/\S+/gu) ?? [];
}

function createOverlappingChunks(
  tokens: readonly PageToken[],
  chapters: readonly DocumentChapter[],
  config: Pick<DocumentConfig, "chunkMaxTokens" | "chunkOverlapTokens">,
): readonly PlannedDocumentChunk[] {
  const chunks: PlannedDocumentChunk[] = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + config.chunkMaxTokens, tokens.length);
    const window = tokens.slice(start, end);
    const firstToken = window[0];
    const lastToken = window.at(-1);

    if (!firstToken || !lastToken) {
      break;
    }

    chunks.push({
      chapterTitle: findChapterTitle(chapters, firstToken.pageNumber),
      chunkText: window.map((token) => token.value).join(" "),
      pageEnd: lastToken.pageNumber,
      pageStart: firstToken.pageNumber,
    });

    if (end === tokens.length) {
      break;
    }

    start = Math.max(end - config.chunkOverlapTokens, start + 1);
  }

  return chunks;
}

function detectChapters(
  pages: readonly ExtractedPdfPage[],
  pageCount: number,
): readonly DocumentChapter[] {
  const headings = pages
    .map(findChapterHeading)
    .filter((heading): heading is DetectedChapterHeading => Boolean(heading));

  if (headings.length === 0) {
    return [
      {
        chapterTitle: DEFAULT_CHAPTER_TITLE,
        endPage: pageCount,
        startPage: 1,
      },
    ];
  }

  const chapters: DocumentChapter[] = [];
  const firstHeading = headings[0];

  if (firstHeading && firstHeading.pageNumber > 1) {
    chapters.push({
      chapterTitle: DEFAULT_CHAPTER_TITLE,
      endPage: firstHeading.pageNumber - 1,
      startPage: 1,
    });
  }

  headings.forEach((heading, index) => {
    const nextHeading = headings[index + 1];
    chapters.push({
      chapterTitle: heading.title,
      endPage: nextHeading ? nextHeading.pageNumber - 1 : pageCount,
      startPage: heading.pageNumber,
    });
  });

  return chapters;
}

function findChapterHeading(
  page: ExtractedPdfPage,
): DetectedChapterHeading | null {
  const lines = page.text
    .split(/\r?\n/u)
    .map(normalizeWhitespace)
    .filter((line) => line.length > 0);

  const heading = lines.find(isChapterHeading);

  return heading
    ? {
        pageNumber: page.pageNumber,
        title: truncateChapterTitle(heading),
      }
    : null;
}

function isChapterHeading(line: string): boolean {
  return (
    /^(?:chapter|chương|chuong)\s+[\dA-ZIVXLCDM]+(?:\s*[:.\-–]\s*|\s+).{2,160}$/iu.test(
      line,
    ) ||
    /^\d{1,2}(?:\.\d{1,2}){0,3}\s+[\p{L}][\p{L}\p{N}\s,:'"()[\]\-–]{2,160}$/u.test(
      line,
    )
  );
}

function findChapterTitle(
  chapters: readonly DocumentChapter[],
  pageNumber: number,
): string | null {
  return (
    chapters.find(
      (chapter) =>
        chapter.startPage <= pageNumber && chapter.endPage >= pageNumber,
    )?.chapterTitle ?? null
  );
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * Some PDFs encode Vietnamese glyphs as individual positioned characters and
 * use private-use font glyphs for bullets. Rejoin those fragments before
 * chunking so both the reader and AI receive readable source text.
 */
export function normalizeExtractedText(text: string): string {
  // Private-use glyphs are often bullets/icons embedded by the PDF's font;
  // browsers cannot render them, so replace them with a portable bullet.
  // Word spacing is intentionally retained: without font-position metadata,
  // aggressively joining Vietnamese fragments can merge distinct words.
  return normalizeWhitespace(text.replace(/[\uE000-\uF8FF]/gu, " • "));
}

function truncateChapterTitle(title: string): string {
  return title.slice(0, MAX_CHAPTER_TITLE_LENGTH);
}
