import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { ITutorService } from "../src/modules/tutor/tutor-service.js";
import type { IAuthProvider } from "../src/ports/index.js";
import {
  createChatServiceStub,
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const userId = "22222222-2222-4222-8222-222222222222";

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

function createTutorServiceStub(): ITutorService {
  return {
    ask: vi.fn(async () => ({
      answer: "Pedagogical response.",
      model: "test-model",
    })),
  };
}

describe("Tutor routes", () => {
  it("POST /api/v1/tutor/ask returns 200 with tutoring answer", async () => {
    const authProvider = createAuthProvider();
    const tutorService = createTutorServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      undefined,
      undefined,
      tutorService,
    );

    const response = await request(app)
      .post("/api/v1/tutor/ask")
      .set("Authorization", "Bearer token-123")
      .send({ question: "What is photosynthesis?" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("Pedagogical response.");
    expect(tutorService.ask).toHaveBeenCalledWith({
      documentId: undefined,
      history: undefined,
      question: "What is photosynthesis?",
      topic: undefined,
      userId,
    });
  });
});
