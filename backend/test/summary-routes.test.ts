import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SummaryChapterNotFoundError,
  SummaryDocumentNotFoundError,
  SummaryDocumentNotReadyError,
  SummaryGenerationFailedError,
  SummaryNotFoundError,
  SummarySourceNotFoundError,
} from "../src/modules/summary/summary-errors.js";
import type { SummaryRecord } from "../src/modules/summary/summary-repository.js";
import type { ISummaryService } from "../src/modules/summary/summary-service.js";
import type { IAuthProvider } from "../src/ports/index.js";
import { ProviderConfigurationError } from "../src/provider-errors.js";
import {
  createChatServiceStub,
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const summaryId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-07-07T01:00:00.000Z");
const chapterRef = "Chapter 1";

function createAuthProvider(): IAuthProvider {
  return {
    login: vi.fn(),
    refresh: vi.fn(),
    register: vi.fn(),
    revokeRefreshToken: vi.fn(),
    verifyToken: vi.fn(async () => ({
      email: "student@example.com",
      role: "student" as const,
      sub: userId,
    })),
  };
}

function createSummary(
  documentIdValue = documentId,
  scope: SummaryRecord["scope"] = "full",
  chapterRefValue: string | null = null,
): SummaryRecord {
  return {
    chapterRef: chapterRefValue,
    createdAt,
    documentId: documentIdValue,
    id: summaryId,
    keyPoints: ["Key 1", "Key 2"],
    scope,
    summaryText:
      scope === "chapter"
        ? `Summary for ${chapterRefValue}.`
        : "Full document summary.",
  };
}

function createSummaryService(): ISummaryService {
  return {
    getChapterSummary: vi.fn(async (input) =>
      createSummary(input.documentId, "chapter", input.chapterRef),
    ),
    getFullDocumentSummary: vi.fn(async () => createSummary()),
    summarizeChapter: vi.fn(async (input) =>
      createSummary(input.documentId, "chapter", input.chapterRef),
    ),
    summarizeFullDocument: vi.fn(async (input) =>
      createSummary(input.documentId),
    ),
  };
}

describe("summary HTTP routes", () => {
  let authProvider: IAuthProvider;
  let summaryService: ISummaryService;

  beforeEach(() => {
    authProvider = createAuthProvider();
    summaryService = createSummaryService();
  });

  function app() {
    return createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );
  }

  it("returns a cached full-document summary", async () => {
    const response = await request(app())
      .get(`/api/v1/documents/${documentId}/summary`)
      .query({ scope: "full" })
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      summary: {
        chapterRef: null,
        createdAt: createdAt.toISOString(),
        documentId,
        id: summaryId,
        keyPoints: ["Key 1", "Key 2"],
        scope: "full",
        summaryText: "Full document summary.",
      },
    });
    expect(summaryService.getFullDocumentSummary).toHaveBeenCalledWith({
      documentId,
      userId,
    });
  });

  it("summarizes a full document with optional force refresh", async () => {
    const response = await request(app())
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer access-token")
      .send({
        forceRefresh: true,
        scope: "full",
      });

    expect(response.status).toBe(200);
    expect(response.body.summary.scope).toBe("full");
    expect(summaryService.summarizeFullDocument).toHaveBeenCalledWith({
      documentId,
      forceRefresh: true,
      userId,
    });
  });

  it("returns a cached chapter summary", async () => {
    const response = await request(app())
      .get(`/api/v1/documents/${documentId}/summary`)
      .query({ chapterRef, scope: "chapter" })
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      chapterRef,
      scope: "chapter",
      summaryText: `Summary for ${chapterRef}.`,
    });
    expect(summaryService.getChapterSummary).toHaveBeenCalledWith({
      chapterRef,
      documentId,
      userId,
    });
  });

  it("summarizes a chapter with optional force refresh", async () => {
    const response = await request(app())
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer access-token")
      .send({
        chapterRef: ` ${chapterRef} `,
        forceRefresh: true,
        scope: "chapter",
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      chapterRef,
      scope: "chapter",
    });
    expect(summaryService.summarizeChapter).toHaveBeenCalledWith({
      chapterRef,
      documentId,
      forceRefresh: true,
      userId,
    });
  });

  it("omits forceRefresh when the client does not send it", async () => {
    const response = await request(app())
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer access-token")
      .send({});

    expect(response.status).toBe(200);
    expect(summaryService.summarizeFullDocument).toHaveBeenCalledWith({
      documentId,
      userId,
    });
  });

  it("rejects unauthenticated summary requests", async () => {
    const response = await request(app())
      .post(`/api/v1/documents/${documentId}/summary`)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
    expect(summaryService.summarizeFullDocument).not.toHaveBeenCalled();
  });

  it.each([
    {
      body: {},
      path: "/api/v1/documents/not-a-uuid/summary",
    },
    {
      body: { scope: "chapter" },
      path: `/api/v1/documents/${documentId}/summary`,
    },
    {
      body: { unexpected: true },
      path: `/api/v1/documents/${documentId}/summary`,
    },
  ])("rejects invalid summary input %#", async ({ body, path }) => {
    const response = await request(app())
      .post(path)
      .set("Authorization", "Bearer access-token")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(summaryService.summarizeFullDocument).not.toHaveBeenCalled();
    expect(summaryService.summarizeChapter).not.toHaveBeenCalled();
  });

  it("rejects invalid chapter summary query input", async () => {
    for (const query of [
      { scope: "chapter" },
      { chapterRef, scope: "full" },
    ]) {
      const response = await request(app())
        .get(`/api/v1/documents/${documentId}/summary`)
        .query(query)
        .set("Authorization", "Bearer access-token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(summaryService.getChapterSummary).not.toHaveBeenCalled();
    expect(summaryService.getFullDocumentSummary).not.toHaveBeenCalled();
  });

  it.each([
    {
      error: new SummaryDocumentNotFoundError(),
      expectedCode: "SUMMARY_DOCUMENT_NOT_FOUND",
      expectedStatus: 404,
    },
    {
      error: new SummaryDocumentNotReadyError(),
      expectedCode: "SUMMARY_DOCUMENT_NOT_READY",
      expectedStatus: 409,
    },
    {
      error: new SummaryChapterNotFoundError(),
      expectedCode: "SUMMARY_CHAPTER_NOT_FOUND",
      expectedStatus: 404,
    },
    {
      error: new SummarySourceNotFoundError(),
      expectedCode: "SUMMARY_SOURCE_NOT_FOUND",
      expectedStatus: 409,
    },
    {
      error: new SummaryGenerationFailedError(),
      expectedCode: "SUMMARY_GENERATION_FAILED",
      expectedStatus: 502,
    },
    {
      error: new ProviderConfigurationError("llm"),
      expectedCode: "PROVIDER_NOT_CONFIGURED",
      expectedStatus: 503,
    },
  ])(
    "maps summary POST error $expectedCode",
    async ({ error, expectedCode, expectedStatus }) => {
      vi.mocked(summaryService.summarizeFullDocument).mockRejectedValueOnce(
        error,
      );

      const response = await request(app())
        .post(`/api/v1/documents/${documentId}/summary`)
        .set("Authorization", "Bearer access-token")
        .send({});

      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.code).toBe(expectedCode);
    },
  );

  it("maps missing cached summary on GET", async () => {
    vi.mocked(summaryService.getFullDocumentSummary).mockResolvedValueOnce(
      null,
    );

    const response = await request(app())
      .get(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SUMMARY_NOT_FOUND");
  });

  it("maps summary not-found errors from service reads", async () => {
    vi.mocked(summaryService.getFullDocumentSummary).mockRejectedValueOnce(
      new SummaryNotFoundError(),
    );

    const response = await request(app())
      .get(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SUMMARY_NOT_FOUND");
  });
});
