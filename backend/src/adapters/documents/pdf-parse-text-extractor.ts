import { getDocument } from "pdfjs-dist-legacy/legacy/build/pdf.js";

import type {
  ExtractedPdfDocument,
  IPdfTextExtractor,
} from "../../modules/documents/pdf-processing.js";

interface PdfTextPageLike {
  readonly num: number;
  readonly text: string;
}

interface PdfTextResultLike {
  readonly pages: readonly PdfTextPageLike[];
  readonly total: number;
}

export interface PdfParserLike {
  destroy(): Promise<void>;
  getText(params?: {
    readonly lineEnforce?: boolean;
    readonly pageJoiner?: string;
  }): Promise<PdfTextResultLike>;
}

export type CreatePdfParser = (data: Uint8Array) => PdfParserLike;

export interface PdfParseTextExtractorDependencies {
  readonly createParser?: CreatePdfParser;
}

export class PdfParseTextExtractor implements IPdfTextExtractor {
  private readonly createParser: CreatePdfParser | undefined;

  constructor(dependencies: PdfParseTextExtractorDependencies = {}) {
    this.createParser = dependencies.createParser;
  }

  async extract(pdf: Uint8Array): Promise<ExtractedPdfDocument> {
    if (!this.createParser) {
      return extractWithPdfJs(pdf);
    }

    const parser = this.createParser(pdf);

    try {
      const result = await parser.getText({
        lineEnforce: true,
        pageJoiner: "",
      });

      return {
        pageCount: result.total,
        pages: result.pages.map((page) => ({
          pageNumber: page.num,
          text: page.text,
        })),
      };
    } finally {
      await parser.destroy();
    }
  }
}

async function extractWithPdfJs(pdf: Uint8Array): Promise<ExtractedPdfDocument> {
  // pdf.js rejects Buffer (a Uint8Array subclass); copy into a plain Uint8Array.
  const data = new Uint8Array(pdf);
  const document = await getDocument({ data }).promise;

  try {
    const pages = await Promise.all(
      Array.from({ length: document.numPages }, async (_, index) => {
        const page = await document.getPage(index + 1);
        const content = await page.getTextContent();
        return {
          pageNumber: index + 1,
          text: content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
        };
      }),
    );
    return { pageCount: document.numPages, pages };
  } finally {
    await document.destroy();
  }
}
