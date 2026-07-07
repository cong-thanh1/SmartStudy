import type { ILLMProvider } from "../../ports/index.js";
import type { IDocumentRepository } from "../documents/document-repository.js";
import {
  TutorDocumentNotFoundError,
  TutorGenerationError,
} from "./tutor-errors.js";

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

      const chunks = await this.documentRepository.listChunks(
        input.documentId,
        input.userId,
      );
      if (chunks.length > 0) {
        contextText = `\n\nDocument Reference Context:\n${chunks
          .slice(0, 10)
          .map((c) => c.chunkText)
          .join("\n\n")}`;
      }
    }

    const topicText = input.topic
      ? `\nFocus Area / Topic: ${input.topic}`
      : "";

    const systemPrompt = `You are SmartStudy AI Tutor, an encouraging, patient, and insightful academic tutor. Your goal is to help students understand concepts deeply using pedagogical best practices (e.g., clear analogies, step-by-step explanations, and guiding questions when appropriate). Provide accurate, structured, and helpful responses.${topicText}${contextText}`;

    const messages: { content: string; role: "assistant" | "user" }[] = [];
    if (input.history && input.history.length > 0) {
      messages.push(...input.history);
    }
    messages.push({ content: input.question, role: "user" });

    try {
      const result = await this.llmProvider.generateText({
        messages,
        systemPrompt,
        temperature: 0.5,
      });

      return {
        answer: result.text.trim(),
        model: result.model,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new TutorGenerationError(msg);
    }
  }
}
