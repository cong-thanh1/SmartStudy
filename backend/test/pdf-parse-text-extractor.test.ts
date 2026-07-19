import { describe, expect, it, vi } from "vitest";

import {
  installPdfJsNodePolyfills,
  PdfParseTextExtractor,
  type CreatePdfParser,
  type PdfParserLike,
} from "../src/adapters/documents/pdf-parse-text-extractor.js";

describe("PdfParseTextExtractor", () => {
  it("maps pdf-parse text pages and always destroys the parser", async () => {
    const parser: PdfParserLike = {
      destroy: vi.fn(async () => undefined),
      getText: vi.fn(async () => ({
        pages: [
          {
            num: 1,
            text: "Chapter 1\nalpha",
          },
        ],
        total: 1,
      })),
    };
    const createParser = vi.fn<CreatePdfParser>(() => parser);
    const extractor = new PdfParseTextExtractor({ createParser });
    const pdf = new Uint8Array([1, 2, 3]);

    await expect(extractor.extract(pdf)).resolves.toEqual({
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: "Chapter 1\nalpha",
        },
      ],
    });
    expect(createParser).toHaveBeenCalledWith(pdf);
    expect(parser.getText).toHaveBeenCalledWith({
      lineEnforce: true,
      pageJoiner: "",
    });
    expect(parser.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the parser if text extraction fails", async () => {
    const parser: PdfParserLike = {
      destroy: vi.fn(async () => undefined),
      getText: vi.fn(async () => {
        throw new Error("corrupt PDF");
      }),
    };
    const extractor = new PdfParseTextExtractor({
      createParser: () => parser,
    });

    await expect(extractor.extract(new Uint8Array([1]))).rejects.toThrow(
      "corrupt PDF",
    );
    expect(parser.destroy).toHaveBeenCalledOnce();
  });

  it("installs the browser geometry globals required by pdf.js in Lambda", () => {
    const globals = globalThis as Record<string, unknown>;
    const previous = {
      DOMMatrix: globals.DOMMatrix,
      ImageData: globals.ImageData,
      Path2D: globals.Path2D,
    };

    try {
      delete globals.DOMMatrix;
      delete globals.ImageData;
      delete globals.Path2D;

      installPdfJsNodePolyfills();

      expect(globals.DOMMatrix).toBeTypeOf("function");
      expect(globals.ImageData).toBeTypeOf("function");
      expect(globals.Path2D).toBeTypeOf("function");
      const matrix = new (globals.DOMMatrix as new (values: number[]) => {
        a: number;
        f: number;
      })([2, 0, 0, 3, 4, 5]);
      expect(matrix).toMatchObject({ a: 2, f: 5 });
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete globals[name];
        else globals[name] = value;
      }
    }
  });
});
