import { describe, expect, it } from "vitest";

import {
  EmptyPdfTextError,
  planDocumentChunks,
  normalizeExtractedText,
  type ExtractedPdfDocument,
} from "../src/modules/documents/pdf-processing.js";

const config = {
  chunkMaxTokens: 5,
  chunkOverlapTokens: 1,
};

describe("PDF processing planner", () => {
  it("detects basic chapter headings and creates overlapping chunks", () => {
    const document: ExtractedPdfDocument = {
      pageCount: 2,
      pages: [
        {
          pageNumber: 1,
          text: "Chapter 1 Basics\nalpha beta gamma delta epsilon zeta",
        },
        {
          pageNumber: 2,
          text: "Chương 2 Nâng cao\neta theta iota kappa",
        },
      ],
    };

    const plan = planDocumentChunks(document, config);

    expect(plan.chapters).toEqual([
      {
        chapterTitle: "Chapter 1 Basics",
        endPage: 1,
        startPage: 1,
      },
      {
        chapterTitle: "Chương 2 Nâng cao",
        endPage: 2,
        startPage: 2,
      },
    ]);
    expect(plan.chunks.map((chunk) => chunk.chapterTitle)).toEqual([
      "Chapter 1 Basics",
      "Chapter 1 Basics",
      "Chapter 1 Basics",
      "Chương 2 Nâng cao",
    ]);
    expect(plan.chunks[1]?.chunkText.startsWith("beta ")).toBe(true);
    expect(plan.chunks[2]).toMatchObject({
      pageEnd: 2,
      pageStart: 1,
    });
  });

  it("uses a default document chapter when headings are absent", () => {
    const plan = planDocumentChunks(
      {
        pageCount: 1,
        pages: [
          {
            pageNumber: 1,
            text: "alpha beta gamma",
          },
        ],
      },
      config,
    );

    expect(plan.chapters).toEqual([
      {
        chapterTitle: "Document",
        endPage: 1,
        startPage: 1,
      },
    ]);
    expect(plan.chunks).toHaveLength(1);
    expect(plan.chunks[0]).toMatchObject({
      chapterTitle: "Document",
      chunkText: "alpha beta gamma",
      pageEnd: 1,
      pageStart: 1,
    });
  });

  it("rejects PDFs without extractable text", () => {
    expect(() =>
      planDocumentChunks(
        {
          pageCount: 1,
          pages: [
            {
              pageNumber: 1,
              text: "   \n\t ",
            },
          ],
        },
        config,
      ),
    ).toThrow(EmptyPdfTextError);
  });

  it("rejects invalid chunking config", () => {
    expect(() =>
      planDocumentChunks(
        {
          pageCount: 1,
          pages: [
            {
              pageNumber: 1,
              text: "alpha beta",
            },
          ],
        },
        {
          chunkMaxTokens: 10,
          chunkOverlapTokens: 10,
        },
      ),
    ).toThrow(RangeError);
  });

  it("repairs separated glyphs and private-use bullet characters", () => {
    expect(normalizeExtractedText("Đ ị a ch ỉ  m u l t i c a s t")).toBe(
      "Đ ị a ch ỉ • m u l t i c a s t",
    );
  });
});
