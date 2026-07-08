import type { ILLMProvider } from "../../ports/index.js";

export class MockLLMProvider implements ILLMProvider {
  async generateStructuredJSON<T>(input: {
    messages: { role: string; content: string }[];
    schemaDescription: string;
    systemPrompt: string;
    temperature?: number;
  }): Promise<T> {
    // Parse numQuestions from systemPrompt if available
    let numQuestions = 10;
    const match = input.systemPrompt.match(/exactly (\d+)/i);
    if (match && match[1]) {
      numQuestions = parseInt(match[1], 10);
    }

    const questions = Array.from({ length: numQuestions }).map((_, i) => ({
      correct_answer: "Option A",
      explanation: "This is a mock explanation for the correct answer.",
      options: ["Option A", "Option B", "Option C", "Option D"],
      question_id: `q${i + 1}`,
      question_text: `Mock Question ${i + 1}?`,
    }));

    return { questions } as unknown as T;
  }

  async generateText(input: {
    messages: { role: string; content: string }[];
    systemPrompt?: string;
    temperature?: number;
  }): Promise<{ text: string }> {
    return { text: "This is a mock LLM response." };
  }
}
