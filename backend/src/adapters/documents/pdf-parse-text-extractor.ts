import type {
  ExtractedPdfDocument,
  IPdfTextExtractor,
} from "../../modules/documents/pdf-processing.js";
import type * as PdfJs from "pdfjs-dist-legacy/legacy/build/pdf.mjs";

type PdfJsModule = typeof PdfJs;

let pdfJsModule: Promise<PdfJsModule> | undefined;

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
  const { getDocument } = await loadPdfJs();
  // pdf.js rejects Buffer (a Uint8Array subclass); copy into a plain Uint8Array.
  const data = new Uint8Array(pdf);
  const document = await getDocument({ data, verbosity: 0 }).promise;

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

function loadPdfJs(): Promise<PdfJsModule> {
  installPdfJsNodePolyfills();
  pdfJsModule ??= import("pdfjs-dist-legacy/legacy/build/pdf.mjs");
  return pdfJsModule;
}

/**
 * pdf.js 5 accesses browser geometry globals while its module is initialized,
 * even when callers only extract text. Node.js and AWS Lambda do not provide
 * them. Lazy-loading after these lightweight shims keeps the text-only path
 * independent from native canvas packages.
 */
export function installPdfJsNodePolyfills(): void {
  if (!("DOMMatrix" in globalThis)) {
    Object.defineProperty(globalThis, "DOMMatrix", {
      configurable: true,
      value: class DOMMatrix {
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;

        constructor(values?: readonly number[]) {
          if (values && values.length >= 6) {
            this.a = values[0]!;
            this.b = values[1]!;
            this.c = values[2]!;
            this.d = values[3]!;
            this.e = values[4]!;
            this.f = values[5]!;
          }
        }
      },
      writable: true,
    });
  }

  for (const name of ["ImageData", "Path2D"] as const) {
    if (!(name in globalThis)) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: class {},
        writable: true,
      });
    }
  }
}
