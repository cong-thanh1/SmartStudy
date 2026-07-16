import type { ILLMProvider } from "../../ports/index.js";
import type { IDocumentRepository } from "../documents/document-repository.js";
import {
  TutorDocumentNotFoundError,
  TutorGenerationError,
} from "./tutor-errors.js";

const TUTOR_MAX_CONTEXT_CHARACTERS = 4_500;
const TUTOR_MAX_HISTORY_MESSAGES = 6;
const TUTOR_MAX_HISTORY_MESSAGE_CHARACTERS = 1_000;
const TUTOR_MAX_OUTPUT_TOKENS = 192;

export interface TutorAskInput {
  readonly documentId?: string;
  readonly history?: readonly { readonly content: string; readonly role: "assistant" | "user" }[];
  readonly question: string;
  readonly topic?: string;
  readonly userId: string;
}

export interface TutorAskResult {
  readonly answer: string;
  readonly model: string;
}

export interface ITutorService {
  ask(input: TutorAskInput): Promise<TutorAskResult>;
}

export class TutorService implements ITutorService {
  constructor(
    private readonly documentRepository: IDocumentRepository,
    private readonly llmProvider: ILLMProvider,
  ) {}

  async ask(input: TutorAskInput): Promise<TutorAskResult> {
    let contextText = "";

    if (input.documentId) {
      const document = await this.documentRepository.findOwnedById(
        input.documentId,
        input.userId,
      );
      if (!document) {
        throw new TutorDocumentNotFoundError(input.documentId);
      }

      const chunks = await this.documentRepository.listChunks({
        documentId: input.documentId,
        userId: input.userId,
      });
      if (chunks.length > 0) {
        contextText = `\n\nDocument Reference Context:\n${buildBoundedContext(
          chunks.map((chunk) => chunk.chunkText),
        )}`;
      }
    }

    const topicText = input.topic
      ? `\nFocus Area / Topic: ${input.topic}`
      : "";

    const systemPrompt = `You are SmartStudy AI Tutor, an encouraging, patient, and insightful academic tutor. Your goal is to help students understand concepts deeply using pedagogical best practices (e.g., clear analogies, step-by-step explanations, and guiding questions when appropriate). Provide accurate, structured, and helpful responses. Respond only in Vietnamese or English; never use Chinese, Japanese, Korean, or another writing system.${topicText}${contextText}`;

    const messages: { content: string; role: "assistant" | "user" }[] = [];
    if (input.history && input.history.length > 0) {
      messages.push(
        ...input.history.slice(-TUTOR_MAX_HISTORY_MESSAGES).map((message) => ({
          content: message.content.slice(-TUTOR_MAX_HISTORY_MESSAGE_CHARACTERS),
          role: message.role,
        })),
      );
    }
    messages.push({ content: input.question, role: "user" });

    try {
      const result = await this.llmProvider.generateText({
        maxTokens: TUTOR_MAX_OUTPUT_TOKENS,
        messages,
        systemPrompt,
        temperature: 0.5,
      });

      return {
        answer: result.text.trim(),
        model: "configured-llm",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new TutorGenerationError(msg);
    }
  }
}

function buildBoundedContext(chunks: readonly string[]): string {
  let context = "";

  for (const chunk of chunks) {
    const separator = context.length === 0 ? "" : "\n\n";
    const remaining = TUTOR_MAX_CONTEXT_CHARACTERS - context.length - separator.length;
    if (remaining <= 0) break;
    context += separator + chunk.slice(0, remaining);
  }

  return context;
}
