import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IChatService } from "../src/modules/chat/chat-service.js";
import {
  ChatContextNotFoundError,
  ChatDocumentNotFoundError,
  ChatDocumentNotReadyError,
  ConversationNotFoundError,
} from "../src/modules/chat/chat-errors.js";
import type { IAuthProvider } from "../src/ports/index.js";
import { ProviderConfigurationError } from "../src/provider-errors.js";
import {
  createChatServiceStub,
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const conversationId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-07-06T01:00:00.000Z");

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

describe("chat HTTP routes", () => {
  let authProvider: IAuthProvider;
  let chatService: IChatService;

  beforeEach(() => {
    authProvider = createAuthProvider();
    chatService = createChatServiceStub();
    vi.mocked(chatService.createConversation).mockResolvedValue({
      createdAt,
      documentId,
      id: conversationId,
      title: "Physics Notes",
    });
    vi.mocked(chatService.sendMessage).mockResolvedValue({
      assistantMessage: {
        citations: [
          {
            documentId,
            page: 2,
            snippet: "Objects resist changes in motion.",
          },
        ],
        content: "Inertia is resistance to changes in motion [S1].",
        createdAt,
        id: "assistant-message",
        role: "assistant",
      },
      conversationId,
      userMessage: {
        citations: [],
        content: "What is inertia?",
        createdAt,
        id: "user-message",
        role: "user",
      },
    });
  });

  function app() {
    return createTestApp(
      authProvider,
      createDocumentServiceStub(),
      chatService,
    );
  }

  it("creates an authenticated document conversation", async () => {
    const response = await request(app())
      .post("/api/v1/chat/conversations")
      .set("Authorization", "Bearer access-token")
      .send({
        documentId,
        title: " Mechanics review ",
      });

    expect(response.status).toBe(201);
    expect(response.body.conversation.id).toBe(conversationId);
    expect(chatService.createConversation).toHaveBeenCalledWith({
      documentId,
      title: "Mechanics review",
      userId,
    });
  });

  it("sends a message and returns deterministic citations", async () => {
    const response = await request(app())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", "Bearer access-token")
      .send({
        content: " What is inertia? ",
      });

    expect(response.status).toBe(201);
    expect(response.body.assistantMessage.citations[0]).toEqual({
      documentId,
      page: 2,
      snippet: "Objects resist changes in motion.",
    });
    expect(chatService.sendMessage).toHaveBeenCalledWith({
      content: "What is inertia?",
      conversationId,
      userId,
    });
  });

  it("rejects unauthenticated chat requests", async () => {
    const response = await request(app())
      .post("/api/v1/chat/conversations")
      .send({ documentId });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
    expect(chatService.createConversation).not.toHaveBeenCalled();
  });

  it.each([
    {
      body: { documentId: "not-a-uuid" },
      path: "/api/v1/chat/conversations",
    },
    {
      body: { documentId, unexpected: true },
      path: "/api/v1/chat/conversations",
    },
    {
      body: { content: " " },
      path: `/api/v1/chat/conversations/${conversationId}/messages`,
    },
    {
      body: { content: "Question", unexpected: true },
      path: `/api/v1/chat/conversations/${conversationId}/messages`,
    },
    {
      body: { content: "Question" },
      path: "/api/v1/chat/conversations/not-a-uuid/messages",
    },
  ])("rejects invalid chat input %#", async ({ body, path }) => {
    const response = await request(app())
      .post(path)
      .set("Authorization", "Bearer access-token")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    {
      error: new ChatDocumentNotFoundError(),
      expectedCode: "CHAT_DOCUMENT_NOT_FOUND",
      expectedStatus: 404,
      method: "create" as const,
    },
    {
      error: new ChatDocumentNotReadyError(),
      expectedCode: "CHAT_DOCUMENT_NOT_READY",
      expectedStatus: 409,
      method: "create" as const,
    },
    {
      error: new ConversationNotFoundError(),
      expectedCode: "CONVERSATION_NOT_FOUND",
      expectedStatus: 404,
      method: "send" as const,
    },
    {
      error: new ChatContextNotFoundError(),
      expectedCode: "CHAT_CONTEXT_NOT_FOUND",
      expectedStatus: 409,
      method: "send" as const,
    },
    {
      error: new ProviderConfigurationError("llm"),
      expectedCode: "PROVIDER_NOT_CONFIGURED",
      expectedStatus: 503,
      method: "send" as const,
    },
  ])(
    "maps chat error $expectedCode",
    async ({ error, expectedCode, expectedStatus, method }) => {
      if (method === "create") {
        vi.mocked(chatService.createConversation).mockRejectedValueOnce(error);
      } else {
        vi.mocked(chatService.sendMessage).mockRejectedValueOnce(error);
      }

      const response =
        method === "create"
          ? await request(app())
              .post("/api/v1/chat/conversations")
              .set("Authorization", "Bearer access-token")
              .send({ documentId })
          : await request(app())
              .post(`/api/v1/chat/conversations/${conversationId}/messages`)
              .set("Authorization", "Bearer access-token")
              .send({ content: "Question" });

      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.code).toBe(expectedCode);
    },
  );
});
