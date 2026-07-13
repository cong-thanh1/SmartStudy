import type {
  GeneratedText,
  GenerateStructuredJsonInput,
  GenerateTextInput,
  ILLMProvider,
} from "../../ports/index.js";

export class MockLLMProvider implements ILLMProvider {
  async generateStructuredJSON<T>(
    input: GenerateStructuredJsonInput,
  ): Promise<T> {
    // Parse numQuestions from systemPrompt if available
    let numQuestions = 10;
    const match = input.systemPrompt?.match(/exactly (\d+)/i);
    if (match && match[1]) {
      numQuestions = Number.parseInt(match[1], 10);
    }

    const isExamSchema = input.schemaDescription.includes("difficulty");
    const questions = Array.from({ length: numQuestions }).map((_, i) => ({
      correct_answer: "Option A",
      ...(isExamSchema ? { difficulty: "medium" } : {}),
      explanation: "This is a mock explanation for the correct answer.",
      options: ["Option A", "Option B", "Option C", "Option D"],
      question_id: `q${i + 1}`,
      question_text: `Mock Question ${i + 1}?`,
    }));

    return { questions } as unknown as T;
  }

  async generateText(input: GenerateTextInput): Promise<GeneratedText> {
    void input;

    return { text: "This is a mock LLM response." };
  }
}
